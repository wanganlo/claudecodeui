# Handoff — claude-ui

> 最后更新: 2026-07-14 21:20:19
> 用途: 换会话时秒回状态。新会话进项目**先读本文件**;再次 /handoff 时旧版自动归档到 handoff_history/。

## 当前任务
简化 CloudCLI / claude-ui 的普通用户界面,并修复管理员用户管理问题。本轮所有需求已闭环,当前处于**已验证、已部署**状态。

## 进度(干到哪了)
- ✅ 普通用户登录后只显示聊天输入框,左侧边栏默认隐藏。
- ✅ 普通用户发第一条消息后,自动创建 Default Chat 项目并显示边栏。
- ✅ 普通用户界面隐藏 Settings / Report Issue / Join Community / 版本 footer。
- ✅ 普通用户隐藏 Tasks / Browser / Claude Watch 等插件标签页。
- ✅ 普通用户跳过 TaskMaster "not configured" 提示和 onboarding(Git 配置 / Connect Agents)。
- ✅ 管理员 Settings → Users 页面 "Failed to load users" 报错已修复。
- ✅ 管理员 Users 页面已新增 Edit / Delete 用户功能(含密码重置)。
- ✅ 点击 Projects 侧边栏不再出现 `/home/admin` 这个 admin 目录。
- ✅ 已检查并过滤其他可能暴露 `/home/admin` 的表面:Projects 列表、归档项目、会话搜索、归档会话、实时 WebSocket 推送。
- ✅ 前后端已重新构建,`cloudcli.service` 已重启并验证生效。

## 卡点 / 待确认
- [x] 无卡点。所有改动已跑通并截图/接口验证。
- 待答复/待操作标记(如有): 无

## 下一步(接手后先做这个)
1. 若磊哥提出新的 UI 简化点,按同样模式在对应组件加 `useIsAdmin()`  gate + 后端过滤。
2. 若后续要彻底清理 DB 里已有的 `/home/admin` project/sessions 行,可单独写迁移脚本(目前只是隐藏,未删除数据)。

## 关键文件 / 本轮改动
- `server/shared/utils.ts` — 新增 `isHiddenProjectPath()` / `HOME_PROJECT_PATH`,统一判定用户 home 目录为隐藏项目路径。
- `server/modules/projects/services/projects-with-sessions-fetch.service.ts` — `getProjectsWithSessions` / `getArchivedProjectsWithSessions` 过滤 `/home/admin`。
- `server/modules/providers/services/session-conversations-search.service.ts` — 会话搜索排除 `/home/admin` 路径下的会话。
- `server/modules/providers/services/sessions.service.ts` — `listArchivedSessions` 排除 `/home/admin` 路径。
- `server/modules/providers/services/sessions-watcher.service.ts` — 实时 `session_upserted` 事件过滤 `/home/admin`。
- `src/components/app/AppContent.tsx` — 普通新用户默认隐藏左侧边栏。
- `src/components/main-content/view/MainContent.tsx` — 非管理员隐藏 Tasks / Browser / 插件标签,并重置到 chat。
- `src/components/main-content/view/subcomponents/LandingChatView.tsx` — 普通用户落地页,首条消息自动创建 Default Chat 项目并进入会话。
- `src/components/main-content/view/subcomponents/MainContentTabSwitcher.tsx` / `MainContentHeader.tsx` / `types/types.ts` — 新增 `shouldShowPlugins` 控制插件标签渲染。
- `src/components/sidebar/view/subcomponents/SidebarFooter.tsx` / `SidebarCollapsed.tsx` — 非管理员隐藏设置/反馈/社区入口。
- `src/components/auth/view/ProtectedRoute.tsx` — 非管理员跳过 onboarding。
- `src/components/task-master/view/NextTaskBanner.tsx` — 非管理员不显示 TaskMaster 提示条。
- `server/modules/projects/projects.routes.ts` — 新增 `POST /api/projects/ensure-default-chat`。
- `server/routes/auth.js` — 新增 `PUT /api/auth/users/:id` 和 `DELETE /api/auth/users/:id`,支持编辑/删除/改密码。
- `server/modules/database/repositories/users.ts` — 新增 `updateUser` / `updatePassword` / `deleteUser`。
- `src/utils/api.js` — 新增 `api.auth.users.list/create/update/delete`。
- `src/components/settings/view/tabs/UsersTab.tsx` — 重写用户管理 UI,增加 Edit/Delete 功能。
- `dist/` 与 `dist-server/` — 已重新构建。

## 别踩的坑
- 测试 JWT 必须用 `/home/admin/.cloudcli/auth.db` 里 `app_config.jwt_secret` 的**完整 128 字符**,之前用了截断的 secret 导致 token 被误判为无效。
- 运行中的服务读的是 `/home/admin/.cloudcli/auth.db`,不是 `dist-server/database/auth.db`;改完代码必须 `npm run build:server && npm run build:client && sudo systemctl restart cloudcli.service`。
- `normalizeProjectPath()` 保留文件系统根路径,所以 `/home/admin` 不会被截断,必须显式用 `isHiddenProjectPath()` 过滤。
- 普通用户首次进入时 app 有一个同步/加载过程,Playwright 截图要等待落地页标题或聊天输入框出现,不能只看 loading spinner。

## 相关 memory
- [[oa-cashflow-ledger-rebuild-plan]]
- [[oa-cashflow-report-chain]]
- [[cc-llm-dashboard-architecture]]
- [[磊哥授权 OA 自动登录]]
- [[OA 自动登录 skill]]
- [[三次以上操作自动生成 skill]]
