# claude-ui 4 项改动 · 会话交接文档

> 保存时间:2026-07-08 17:15 | 分支:main | 会话名:`claude-ui-4fixes`
> 新会话接手:直接读本文件即可恢复全部上下文。

## 磊哥的 4 个原始需求(原文)

1. 所有人对话框上传附件,只能传图片 → 改为**允许所有文件类型**
2. admin 拖文件到文件夹,上传完成后报 **413 错误**
3. 聊天会话记录后面加**归档按钮**,对所有用户生效
4. **新会话一律报错**:`Session "e493a364-9926-4302-9187-5a5e2c60d544" was not found.`

## 部署架构(必读)

- 后端:Node TS → 编译 `dist-server/`,systemd `cloudcli.service`(PID 317266,127.0.0.1:3001)
- **改后端必先 `npm run build` 再 `sudo systemctl restart cloudcli.service`**
- nginx 反代:`/etc/nginx/conf.d/cloudcli-8080.conf`(8080 → /claude/ → 3001)
- 前端:React+vite,base=`/claude/`,`npm run build` 出 `dist/`
- GLM-5.2 经 headroom(127.0.0.1:8787),**有 5h 滚动配额坑**

---

## #2 拖文件 413 — ✅ 已修复(2026-07-08 17:10)

**根因**:nginx 全配置缺 `client_max_body_size`,默认 1MB 卡死反代层。后端 multer 已放 200MB,非瓶颈。

**已改**:`/etc/nginx/conf.d/cloudcli-8080.conf` server 块第 4 行加 `client_max_body_size 200m;`,已 `nginx -t` + `reload`,worker PID 已换新确认生效。备份 `cloudcli-8080.conf.bak.hermes-chat-fix-20260708`。

**待验证**:磊哥实际拖一个大文件到文件夹测一下不再 413。

---

## #3 会话归档按钮 — ✅ 后端全就绪,只缺前端按钮

**关键结论**:sessions 表 `isArchived` 列早就有(schema.ts:116 / migrations.ts:261)。后端 `sessionsService.deleteOrArchiveSessionById`/`restoreSessionById`/`listArchivedSessions` + 路由 `DELETE/POST /sessions/:id(/restore)` + API 客户端 `deleteSession/restoreSession/archivedSessions` **全部现成**。

后端 sessions 归档走 `assertOwnsSession`(所有者校验,**非 requireAdmin**),所以**全用户天然可用**。

**要写的代码**(纯前端):
- `src/components/sidebar/view/subcomponents/SidebarSessionItem.tsx`:桌面端按钮组(L310-335,Edit2 与 Trash2 之间)+ 移动端块(L185-195)加 Archive 图标按钮(ArchiveBox from lucide-react)
- **归档按钮不带 `isAdmin` 门禁**(全用户生效),调 `deleteSession(sessionId, false)`(软归档,force=false)
- 新增 `onArchiveSession` prop(类型在 L13-34),串通上游 `SidebarContent.tsx` → `useSidebarController.ts`
- 参考 `SidebarProjectItem.tsx` 的删除按钮范式(L99 isAdmin, L377-387)

**关键行号**:
- SidebarSessionItem.tsx:82 `const isAdmin = useIsAdmin()`、120 `requestDeleteSession`、264-336 桌面 hover 浮层、310-335 按钮组
- `src/utils/api.js:89` `deleteSession(sessionId, hardDelete=false)` — hardDelete=false 走软归档

---

## #1 附件放开文件类型 — ⚠️ 限制点定位,有深度决策

**当前限制点**(4+2 处):
- 前端 `src/components/chat/hooks/useChatComposerState.ts`:L490 image/ 前缀校验、L521 粘贴过滤、L532 拖拽过滤、L542-543 dropzone `accept: { 'image/*': [...] }`、L551 `maxSize: 5MB`
- 后端 `server/index.js`:L1078 `POST /api/projects/:projectId/upload-images`、L1100-1107 `fileFilter` 白名单(5 种图片)、L1111-1112 `fileSize: 5MB`
- **上传链路**:后端把文件读成 base64,返回 `data:${mimeType};base64,...`(L1139-1144),前端当 image block 塞进 Claude 消息

**深度决策点**:放开 accept 简单,但非图片(PDF/docx/文本)直接当 image block 传 Claude 会解码失败。要"能传能读"需按 mimeType 分流:image→image block、PDF→document block(Claude 原生支持)、文本→text block。

**待答复一**:深度选哪个?
- A) 简单放开(去掉 image/* 限制 + 后端白名单,仍按 image base64 传)—— 快但非图片 Claude 读不了
- B) 完整分流(image/PDF/text 各自正确的 content block)—— 符合"各种文件类型"诉求,改动大

**需补查**:前端 `useChatComposerState.ts` 上传完成后构建消息 content block 的代码(L607 附近 upload-images 调用点之后),确认当前只构建 image block。

---

## #4 新会话 not found — ✅ 已按「超管视图」方案 C 闭环

**根因(已 100% 复现确认,非 bug)**:admin(uid=1)在「仟源资金流动项目」(属 user1 uid=10)对话发消息报 `Session "f0d1d718-..." was not found`。这是 B2 多用户改造(commit bcfd0b4)的越权拦截在正确工作 —— `assertOwnsSession(session.user_id=10, userId=1)` 拦截抛 SESSION_NOT_FOUND。用 admin token 复现逐字匹配截图;user1 token 同操作 200 正常。

**方案**:给 admin 加持久化「超管视图」开关,默认关;开启后 admin 跨用户**读写**已存在 projects/sessions,但**禁止新建**对话。开关存 DB `user_preferences`,后端鉴权层统一读取挂到 `user.scopeAll`。

**关键代码行**(最终状态):
- `server/shared/utils.ts:131` `assertOwnsSession(session, userId, actingUser?)` 对 `is_admin===1 && scopeAll` 豁免
- `server/middleware/auth.js` `attachScopeAll(user)` 在 platform HTTP/OSS HTTP/platform WS/OSS WS 四路挂载
- `server/modules/websocket/services/chat-websocket.service.ts:136` `handleChatSend` 传 `request.user` 作 `actingUser`
- `server/modules/providers/provider.routes.ts:542` createAppSession 超管 403 `SUPERADMIN_NO_CREATE`
- `server/modules/database/repositories/projects.db.ts` / `sessions.db.ts` 加 `scopeAll` 分支去掉 `AND user_id=?`
- `src/contexts/AdminScopeContext.tsx` + `src/components/settings/view/tabs/UsersTab.tsx` 开关 UI
- `src/contexts/WebSocketContext.tsx` / `src/hooks/useProjectsState.ts` scopeAll 变化自动重连/重载
- `src/components/main-content/view/subcomponents/MainContentHeader.tsx` 顶栏「Superadmin」标记
- `src/components/sidebar/view/subcomponents/SidebarProjectSessions.tsx` 超管模式下禁用「New session」按钮

**自主验证结果**(2026-07-08):
- admin 默认(scopeAll=false)GET `/api/projects` 只返回 admin 自己的项目
- PUT `/api/user/preferences` {superadmin_view:true} 后 scopeAll=true,GET `/api/projects` 出现 user1 的「仟源资金流动项目」
- WS `chat.send` 到 user1 的 `f0d1d718-...` 不再 SESSION_NOT_FOUND(仅因该会话已有运行中而被 RUN_IN_PROGRESS 拦截)
- POST `/api/providers/sessions` 在 scopeAll=true 时返回 403 `SUPERADMIN_NO_CREATE`
- 关超管后恢复原始隔离行为

**待操作一**:磊哥浏览器验证 — 用 admin 登录 → Settings → Users → 打开「Superadmin View」→ 侧栏出现所有项目 → 进入 user1「仟源资金流动项目」发消息,应不再报 not found。顶栏显示红色 Superadmin 标记,项目下的「New session」按钮禁用。

---

## 进度看板

| # | 需求 | 状态 | 下一步 |
|---|------|------|--------|
| 2 | 413 | ✅ 已修(nginx) | 待磊哥实测 |
| 3 | 归档按钮 | ⏳ 后端就绪 | 写前端 SidebarSessionItem |
| 1 | 文件类型 | ⏳ 已定位 | 待答复一(深度 A/B) |
| 4 | not found | ✅ 超管视图已部署 | 待磊哥浏览器验证(见#4章节) |

> 详细实现与验证结果见上文章节「#4 新会话 not found」。
