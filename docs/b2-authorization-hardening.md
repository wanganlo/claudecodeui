# B2 多用户隔离 · 收尾设计(阶段7:越权加固 + 存档提交)

> 2026-07-08。承接 [[b2-multiuser-plan]](本仓库记忆 claude-ui-b2-multiuser-plan)阶段1-6。
> 磊哥 2026-07-08 拍板:方向=收尾多用户改造;节奏=先存档 C1 再加固 C3;设计系统线 untracked 一律不动。

## 背景
B2 改造给 `projects`/`sessions` 加了 `user_id`,列表层查询已过滤。但**按主键/provider-id 单行查询**的 service 方法签名不接 `userId`,HTTP/WS 入口取到 row 后也不校验 `row.user_id`,导致 14 处越权裸露 + 2 个独立 bug。本设计收尾:存档已完成的阶段1-6,再统一加固。

## 目标 / 验收
- 任意已登录用户无法读/改/删他人 session 或 project(含归档、恢复、重命名、星标、删 jsonl)。
- `getProjectSessionsPage` / `getProjectTaskMaster` 去掉硬编码 `userId=1`,非 user-1 账号能拿到自己的数据。
- `updateCustomProjectNameById` SQL 参数绑定修好。
- `npm run build` 0 error;现有 36 集成测试 + 新增越权测试全绿。
- 成果按 C1/C2/C3 提交;部署到 siteboon(cloudcli.service)。

## 审计结论:14 处越权 + 2 bug

> 行号为审计快照(2026-07-08),执行时核对。

### Sessions 侧(S1-S7,全高危)
| # | 入口 | 文件:行 | 调的 by-id | 危害 |
|---|---|---|---|---|
| S1 | WS `chat.send` | `server/modules/websocket/services/chat-websocket.service.ts:119` | `getSessionById` | 🔴 以受害者工作目录跑 CLI / 消费 token |
| S2 | `DELETE /api/providers/sessions/:sessionId` | `server/modules/providers/provider.routes.ts:560` | `deleteOrArchiveSessionById` | 越权删/归档 |
| S3 | `POST /api/providers/sessions/:sessionId/restore` | `provider.routes.ts:574` | `restoreSessionById` | 越权恢复 |
| S4 | `PUT /api/providers/sessions/:sessionId` | `provider.routes.ts:583` | `renameSessionById` | 越权重命名 |
| S5 | `GET /api/providers/sessions/:sessionId/messages` | `provider.routes.ts:593` | `fetchHistory` | 越权读历史 |
| S6 | `DELETE /api/gemini/sessions/:sessionId` | `server/routes/gemini.js:8` | `deleteSessionById`(直连) | 越权硬删 |
| S7 | `GET /api/projects/:projectId/sessions/:sessionId/token-usage` | `server/index.js:1164` | `getSessionById` | 越权读 token 用量 |

根因:`sessions.service.ts` 的 `fetchHistory`(L151)/ `deleteOrArchiveSessionById`(L233)/ `restoreSessionById`(L280)/ `renameSessionById`(L296)四个方法**不接 userId**,内部 `getSessionById` 后不校验。**仅路由调、watcher 不调**,加 userId 零副作用。

### Projects 侧(P1-P7)
| # | 入口 | 文件:行 | 问题 | 风险 |
|---|---|---|---|---|
| P1 | `DELETE /api/projects/:projectId` | `projects.routes.ts:263` → `project-delete.service.ts:59` | `getProjectById` 未传 userId;用他人 project_path 删 jsonl | 高 |
| P2 | `POST /api/projects/:projectId/restore` | `projects.routes.ts:250` → `project-delete.service.ts:81` | `getProjectById` 未传 userId | 中 |
| P3 | `POST /api/projects/:projectId/toggle-star` | `projects.routes.ts:241` → `project-star.service.ts:66,75` | `getProjectById`/`updateProjectIsStarredById` 均未传 userId | 高 |
| P4 | `PUT /api/projects/:projectId/rename` | `projects.routes.ts:230` → `project-management.service.ts:145` | `updateCustomProjectNameById` 未传 userId **且 SQL 绑定缺参** | 高 |
| P5 | `GET /api/projects/:projectId/sessions` | `projects.routes.ts:93` → `projects-with-sessions-fetch.service.ts:299` | `getProjectById` 未传 userId;`readProjectSessionsPageByPath(...,1,...)` **硬编码 1** | 高 |
| P6 | `GET /api/projects/:projectId/taskmaster` | `projects.routes.ts:221` → `projects-has-taskmaster.service.ts:206` | `getProjectPathById(projectId, 1)` **硬编码 1** | 高 |
| P7 | `projects-with-sessions-fetch.service.ts:150,155` | (被 `GET /api/projects` 间接调) | `getSessionsByProjectPathPage`/`countSessionsByProjectPath` 用默认 1 | 中 |

### 独立 bug(随 P4/P5/P6 一并修)
- **bug-1**:`projects.db.ts:137-141` `updateCustomProjectNameById` 的 SQL `WHERE project_id = ? AND user_id = ?` 只 `.run(customName, projectId)` 绑 2 参 → user_id 占位符为 NULL → 永不匹配。
- **bug-2**:`getProjectSessionsPage` / `getProjectTaskMaster` 硬编码 `userId=1`(即 P5/P6)。

## 加固设计

### 统一模式
1. **service 层 by-id 方法加 `userId: number` 参数**(必填,不给默认值,让 tsc 强制报错列出漏传点)。
2. 方法内 `getSessionById`/`getProjectById` 取 row 后:`if (!row || row.user_id !== userId) throw new OwnershipError('NOT_OWNED')`(或返回既定 not-found 形态,避免区分 403/404 信息泄露 —— **统一对外返 404**)。
3. **路由层** `const userId = requireUserId(req)` 传入。
4. **WS 层**(S1):从已认证 ws 连接取 `userId`,校验 `session.user_id !== userId` 时发 protocol error 并关闭。

### 复用 helper(`server/shared/utils.ts`,紧挨现有 `requireUserId`)
```ts
export class OwnershipError extends Error { code = 'NOT_OWNED' as const }
// 路由/service 取到 row 后调;不通过则 throw OwnershipError,路由 catch → 404
export function assertOwns(row: { user_id: number } | null | undefined, userId: number): void
```
sessions/projects 各封装一个 by-id 版本(内部 getSessionById + assertOwns),减少散落。

### 403 vs 404
统一返 **404**(不返 403)。理由:403 = "存在但不是你的",泄露存在性;404 = "不存在"。对越权攻击者不暴露 id 是否有效。

## 修复清单(执行依据)

### sessions 侧
- `sessions.service.ts`:`fetchHistory`/`deleteOrArchiveSessionById`/`restoreSessionById`/`renameSessionById` 加 `userId` 参数 + ownership 校验。
- `provider.routes.ts`:S2-S5 handler 加 `requireUserId(req)` 传入。
- `gemini.js`:S6 加 `requireUserId`,改走 service 的带 userId 路径(不直连 `deleteSessionById`)。
- `chat-websocket.service.ts`:S1 从 ws 取 userId,`getSessionById` 后 `assertOwns`。
- `index.js`:S7 token-usage,getSessionById 后校验。

### projects 侧
- `projects.db.ts`:`updateCustomProjectNameById` 加 userId 参数 + 补第 3 个绑定值(bug-1)。
- `project-management.service.ts`:P4 `updateProjectDisplayName` 传 userId。
- `project-star.service.ts`:P3 `toggleProjectStar`/`updateProjectIsStarredById` 传 userId。
- `project-delete.service.ts`:P1/P2 `getProjectById` 传 userId(已有重载)。
- `projects-with-sessions-fetch.service.ts`:P5/P7 去硬编码,从 options.userId 透传;`readProjectSessionsPageByPath` 补 userId。
- `projects-has-taskmaster.service.ts`:P6 `getProjectPathById(projectId, userId)`。
- `projects.routes.ts`:P1-P6 handler 统一 `requireUserId(req)` 传 service。

### 低危(不动)
watcher/synchronizer 调 `getSessionByProviderSessionId`/`assignProviderSessionId` 等(无外部入口),设计上不需 userId,不在本次范围。

## 测试计划
补到现有 8 个集成测试文件(sessions.db.integration / projects.db.integration / sessions-provider-mapping 等):
- 每个 destructive 端点一个越权用例:建 user A(id=1)+ user B(id=2),A 尝试读/改/删 B 的 session/project → 断言 404 + 数据未变。
- bug 回归:`updateCustomProjectNameById` 改名后 DB 真生效;非 user-1 用户 `getProjectSessionsPage`/`getProjectTaskMaster` 拿到自己数据。
- WS `chat.send` 越权:发他人 sessionId → 断言连接被拒/无 CLI 启动。

## 提交计划

### C1 `feat(claude-ui): B2 多用户隔离(阶段1-6)`
**modified(已跟踪,多用户线)**:
```
server/index.js
server/modules/database/migrations.ts
server/modules/database/repositories/projects.db.ts
server/modules/database/repositories/sessions.db.ts
server/modules/database/schema.ts
server/modules/projects/projects.routes.ts
server/modules/projects/services/project-clone.service.ts
server/modules/projects/services/project-delete.service.ts
server/modules/projects/services/project-management.service.ts
server/modules/projects/services/project-star.service.ts
server/modules/projects/services/projects-has-taskmaster.service.ts
server/modules/projects/services/projects-with-sessions-fetch.service.ts
server/modules/providers/list/gemini/gemini-session-synchronizer.provider.ts
server/modules/providers/provider.routes.ts
server/modules/providers/services/session-conversations-search.service.ts
server/modules/providers/services/sessions-watcher.service.ts
server/modules/providers/services/sessions.service.ts
server/modules/websocket/services/chat-run-registry.service.ts
server/routes/{agent,auth,git,taskmaster}.js
server/shared/utils.ts
server/tsconfig.json
src/components/auth/view/LoginForm.tsx
src/components/settings/types/types.ts
src/components/settings/view/{Settings,SettingsSidebar}.tsx
src/i18n/locales/{en,zh-CN}/{auth,settings}.json
vite.config.js
.gitignore
```
**untracked(仅 UsersTab,Settings.tsx 已 import)**:
```
src/components/settings/view/tabs/UsersTab.tsx
```
> ⚠ 提交前先确认 `vite.config.js`(+1 行)与 `.gitignore` 的改动属于多用户/部署定制、不夹带设计系统线;执行时核对 diff。

### C2 `chore(claude-ui): 移除上游 siteboon 模板`
deleted:`.env.example`、`.github/ISSUE_TEMPLATE/*`、`.github/workflows/*.yml`、`.gitmodules`、`.npmignore`、`.nvmrc`、`.release-it.json`。

### C3 `fix(claude-ui): 多用户 by-id 越权加固(阶段7)+ SQL 绑定/硬编码 userId 修复`
阶段7 全部改动 + 新越权测试。

### 不提交(设计系统线,原样留工作区)
`docs/*`、`playground/`、14 个新组件、`src/pages/`、`src/main.tsx`、`src/layouts/`、`src/styles/`、`src/hooks/*`、`src/utils/*`、`tailwind.config.ts`、`vite.config.ts`、`tsconfig.tsbuildinfo`、`server/index.mjs`、`server/package.json`、`pnpm-lock.yaml`、`scripts/deploy.sh`。

## 部署
- build:`NODE_OPTIONS=--max-old-space-size=2048 npm run build`(client+server)。
- 重启:`sudo systemctl restart cloudcli.service`(siteboon,@3001,入口 8080/claude/)。
- **不用** `scripts/deploy.sh`(那是自建 9080 线)。
- 冒烟:本地 `curl 127.0.0.1:3001/api/auth/status`;外部 `xms-161` 测 `hermes:8080/claude/`。
- 回滚:C1/C3 各自独立 commit,`git revert C3` 即可回加固。

## 风险
- service 签名变更 → 必须靠 tsc 报错把所有调用点找全(C3 实施时 tsc 先跑一遍清单)。
- WS chat.send(S1)是唯一非 HTTP 入口,测试覆盖要单独搭 ws 客户端。
- 404 vs 403 统一为 404 后,前端对"自己的 session 被并发删除"也会看到 404 —— 行为正确,但要确认前端不会因 404 卡死。
