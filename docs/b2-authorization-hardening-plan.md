# claude-ui B2 多用户收尾 · 实现计划(阶段7)

> **For agentic workers:** REQUIRED SUB-SKILL: 用 superpowers:subagent-driven-development(推荐)或 superpowers:executing-plans 逐任务执行。步骤用 `- [ ]` 复选框跟踪。

**Goal:** 收尾 claude-ui(siteboon)多用户改造 —— 存档阶段1-6,加固 14 处 by-id 越权 + 修 2 个独立 bug,加越权测试,部署 cloudcli。

**Architecture:** 分治加固 —— **projects 侧**:底层 db 方法已带 `AND user_id = ?`,只需 service 层把吞掉的 userId 透传下去(非属主自然 404),无需 assertOwns;**sessions 侧**:`getSessionById` 故意全局(磁盘 watcher 用,SQL 无 user 过滤),所以在 7 个调用点(路由/WS handler)统一加 `assertOwnsSession(session, userId)`。统一对外返 **404**(不泄露 session/project 存在性)。顺手清掉 by-id service 方法的 `userId: number = 1` 默认值(隐性越权源),改必填,靠 tsc 兜底。

**Tech Stack:** TypeScript(server/modules)+ JavaScript(server/routes/*.js、server/index.js)+ Express + better-sqlite3 + Vitest(集成测试)。

## Global Constraints

- 项目根:`/home/admin/files/projects/claude-ui`。所有命令在此目录下跑(`cd` 到该目录)。
- **设计系统线 untracked 文件一律不动**:`docs/*`(除本计划与 spec 已写的)、`playground/`、14 个新组件、`src/pages/`、`src/main.tsx`、`src/layouts/`、`src/styles/`、`src/hooks/*`、`src/utils/*`、`tailwind.config.ts`、`vite.config.ts`、`tsconfig.tsbuildinfo`、`server/index.mjs`、`server/package.json`、`pnpm-lock.yaml`、`scripts/deploy.sh`。
- 提交前必跑 `npm run build`(EXIT 0)与 `npm test`(全绿),不提交坏代码。
- 越权对外统一返 **404**,不用 403(避免泄露 id 存在性)。
- 部署走 siteboon:`systemctl restart cloudcli.service`(@3001,入口 8080/claude/)。**不用** `scripts/deploy.sh`(那是自建 9080 线)。
- 凭证不进 git;.env 已 gitignored。
- 未经磊哥同意不改任何系统密码。

## File Structure(改动总览)

| 文件 | 责任 | 改动 |
|---|---|---|
| `server/shared/utils.ts` | HTTP/所有权 helper | **新增** `assertOwnsSession` + `resolveWsUserId` |
| `server/modules/database/repositories/projects.db.ts` | projects SQL | **修 bug-1**:`updateCustomProjectNameById` 加 userId + 补第 3 绑定 |
| `server/modules/projects/services/project-delete.service.ts` | P1/P2 | L59/L73/L81 透传 userId;去 `=1` 默认值 |
| `server/modules/projects/services/project-star.service.ts` | P3 | L66/L75 透传 userId;去 `=1` |
| `server/modules/projects/services/project-management.service.ts` | P4a | L145 透传 userId + ownership 校验;去 `=1` |
| `server/modules/projects/services/projects-with-sessions-fetch.service.ts` | P5/P7 | L150/155/299/307 透传 userId;`getProjectSessionsPage` 加 userId 入参 |
| `server/modules/projects/services/projects-has-taskmaster.service.ts` | P6 | L206 去硬编码 1;`getProjectTaskMaster` 加 userId 入参 |
| `server/modules/projects/projects.routes.ts` | 路由 | L93/L221 补 `requireUserId` 传给 service(P5/P6) |
| `server/modules/providers/provider.routes.ts` | S2-S5 路由 | 4 handler 加 `requireUserId` + `assertOwnsSession` |
| `server/routes/gemini.js` | S6 | 加 `requireUserId` + `assertOwnsSession` |
| `server/index.js` | S7 | token-usage 加 `assertOwnsSession` |
| `server/modules/websocket/services/chat-websocket.service.ts` | S1 | WS chat.send 加 `assertOwnsSession` |
| 测试(8 个集成文件 + 新增) | 越权用例 | 每个加固端点 A/B 用户用例 |

---

## Task 0:存档前验证 build + 测试 + 核对混杂 diff

**Files:**
- 验证:`package.json`(scripts)、`vite.config.js`、`.gitignore`
- 命令:`npm run build`、`npm test`

**Interfaces:** 无(本任务是门禁,不改代码)

- [ ] **Step 1:核对 `vite.config.js` 与 `.gitignore` 的 diff 属于多用户/部署定制**

Run:
```bash
cd /home/admin/files/projects/claude-ui
git diff vite.config.js .gitignore
```
Expected: `vite.config.js` 仅 `base: '/claude/'` 类子路径改动;`.gitignore` 仅加 `.env` / claude-ui 产物。**若夹带设计系统线内容(如新组件路径、tailwind 引用),暂停,问磊哥如何剥离。**

- [ ] **Step 2:跑 build 确认阶段1-6 + UsersTab 当前可编译**

Run:
```bash
cd /home/admin/files/projects/claude-ui
NODE_OPTIONS=--max-old-space-size=2048 npm run build 2>&1 | tail -20
```
Expected: `EXIT 0`,client + server 都构建成功。**若失败,先修 build(通常是 UsersTab.tsx 或 settings import 问题),再继续;不要提交坏 build。**

- [ ] **Step 3:跑现有测试确认 36 个全绿**

Run:
```bash
cd /home/admin/files/projects/claude-ui
npm test 2>&1 | tail -25
```
Expected: 36 passed / 0 failed(sessions.db.integration、projects.db.integration、sessions-provider-mapping、opencode-sessions、chat-run-registry、project-management、project-star、projects-has-taskmaster)。

---

## Task 1:C1 存档提交 B2 阶段1-6

**Files:** 见 spec 提交计划 C1 的 modified 清单 + `src/components/settings/view/tabs/UsersTab.tsx`

**Interfaces:** 无

- [ ] **Step 1:精确 stage 多用户线文件(modified,不含设计系统线)**

Run:
```bash
cd /home/admin/files/projects/claude-ui
git add \
  server/index.js \
  server/modules/database/migrations.ts \
  server/modules/database/repositories/projects.db.ts \
  server/modules/database/repositories/sessions.db.ts \
  server/modules/database/schema.ts \
  server/modules/projects/projects.routes.ts \
  server/modules/projects/services/project-clone.service.ts \
  server/modules/projects/services/project-delete.service.ts \
  server/modules/projects/services/project-management.service.ts \
  server/modules/projects/services/project-star.service.ts \
  server/modules/projects/services/projects-has-taskmaster.service.ts \
  server/modules/projects/services/projects-with-sessions-fetch.service.ts \
  server/modules/providers/list/gemini/gemini-session-synchronizer.provider.ts \
  server/modules/providers/provider.routes.ts \
  server/modules/providers/services/session-conversations-search.service.ts \
  server/modules/providers/services/sessions-watcher.service.ts \
  server/modules/providers/services/sessions.service.ts \
  server/modules/websocket/services/chat-run-registry.service.ts \
  server/routes/agent.js \
  server/routes/auth.js \
  server/routes/git.js \
  server/routes/taskmaster.js \
  server/shared/utils.ts \
  server/tsconfig.json \
  src/components/auth/view/LoginForm.tsx \
  src/components/settings/types/types.ts \
  src/components/settings/view/Settings.tsx \
  src/components/settings/view/SettingsSidebar.tsx \
  src/i18n/locales/en/auth.json \
  src/i18n/locales/en/settings.json \
  src/i18n/locales/zh-CN/auth.json \
  src/i18n/locales/zh-CN/settings.json \
  vite.config.js \
  .gitignore \
  src/components/settings/view/tabs/UsersTab.tsx
```

- [ ] **Step 2:确认 stage 的内容正确(无设计系统线混入)**

Run:
```bash
git diff --cached --name-only | grep -E 'docs/|playground/|server/index.mjs|pnpm-lock|src/pages/|src/main.tsx|tailwind|vite.config.ts'
```
Expected: **空输出**(无匹配)。若有匹配,说明误 stage,`git restore --staged <file>` 剔除。

- [ ] **Step 3:提交 C1**

Run:
```bash
git commit -m "feat(claude-ui): B2 多用户隔离改造(阶段1-6)

- schema/migration: projects/sessions 加 user_id 列,projects UNIQUE 改复合
- repositories: projects.db/sessions.db 全量 userId 作用域 + 分作用域 by-id
- auth: 去单用户锁,开放注册;LoginForm 双模式;UsersTab 用户管理
- services/routes: 调用点 requireUserId 透传(阶段4)
- i18n: en/zh-CN auth+settings 补 register/users

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
Expected: 提交成功,工作区只剩 deleted(上游模板)与 untracked(设计系统线)。

---

## Task 2:C2 清上游模板

**Files:** `.env.example`、`.github/**`、`.gitmodules`、`.npmignore`、`.nvmrc`、`.release-it.json`(均 deleted)

- [ ] **Step 1:stage 所有 deleted 上游模板**

Run:
```bash
cd /home/admin/files/projects/claude-ui
git add -u .env.example .github .gitmodules .npmignore .nvmrc .release-it.json
```

- [ ] **Step 2:确认工作区只剩设计系统线 untracked**

Run:
```bash
git status --short | grep -vE '^\?\?'
```
Expected: **空输出**(所有已跟踪改动都已提交)。

- [ ] **Step 3:提交 C2**

Run:
```bash
git commit -m "chore(claude-ui): 移除上游 siteboon 模板文件

.github workflows/issue templates、release-it、docker、desktop 等不再适用。

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3:assertOwnsSession + WS userId helper

**Files:**
- Modify: `server/shared/utils.ts`(在 `requireUserId` 之后,L120 附近)
- Test: 找现有 utils 测试文件或新建 `server/shared/utils.ownership.test.ts`

**Interfaces:**
- Produces: `assertOwnsSession(session, userId): asserts session is { user_id: number }` —— 不通过抛 `AppError('Session not found', { code: 'SESSION_NOT_FOUND', statusCode: 404 })`
- Produces: `resolveWsUserId(raw): number | null` —— 把 WS 的 `string|number|null` 归一为 `number|null`

- [ ] **Step 1:写失败测试**

Create `server/shared/utils.ownership.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { assertOwnsSession, resolveWsUserId } from './utils.js';
import { AppError } from './utils.js';

describe('assertOwnsSession', () => {
  it('passes when session.user_id equals userId', () => {
    expect(() => assertOwnsSession({ user_id: 5 }, 5)).not.toThrow();
  });
  it('throws SESSION_NOT_FOUND (404) when user_id mismatches', () => {
    expect(() => assertOwnsSession({ user_id: 5 }, 6)).toThrow(AppError);
    try { assertOwnsSession({ user_id: 5 }, 6); } catch (e) {
      expect((e as AppError).statusCode).toBe(404);
      expect((e as AppError).code).toBe('SESSION_NOT_FOUND');
    }
  });
  it('throws 404 when session is null/undefined (no existence leak)', () => {
    expect(() => assertOwnsSession(null, 1)).toThrow(AppError);
    expect(() => assertOwnsSession(undefined, 1)).toThrow(AppError);
  });
});

describe('resolveWsUserId', () => {
  it('normalizes numeric string to number', () => {
    expect(resolveWsUserId('5')).toBe(5);
  });
  it('passes through number', () => {
    expect(resolveWsUserId(5)).toBe(5);
  });
  it('returns null for null/undefined/non-integer', () => {
    expect(resolveWsUserId(null)).toBeNull();
    expect(resolveWsUserId(undefined)).toBeNull();
    expect(resolveWsUserId('abc')).toBeNull();
  });
});
```

- [ ] **Step 2:跑测试确认失败**

Run: `cd /home/admin/files/projects/claude-ui && npx vitest run server/shared/utils.ownership.test.ts`
Expected: FAIL —— `assertOwnsSession`/`resolveWsUserId` 未导出。

- [ ] **Step 3:实现 helper(加在 `requireUserId` 之后,L120 后)**

在 `server/shared/utils.ts` 的 `requireUserId` 函数之后插入:
```ts
/**
 * Asserts that a session row belongs to the given user. Throws a 404
 * SESSION_NOT_FOUND AppError (NOT 403) when the row is missing or owned by
 * another user, so callers cannot learn whether a session id exists.
 *
 * Use this at every external entry point (HTTP route / WS handler) that
 * touches sessionsDb.getSessionById(...), because getSessionById is
 * intentionally global (no user_id filter) for the disk watcher.
 */
export function assertOwnsSession(
  session: { user_id?: number | null } | null | undefined,
  userId: number,
): asserts session is { user_id: number } {
  if (!session || session.user_id !== userId) {
    throw new AppError('Session not found', {
      code: 'SESSION_NOT_FOUND',
      statusCode: 404,
    });
  }
}

/**
 * Normalizes a websocket-sourced userId (string | number | null) into a
 * number, or null when missing/invalid. WS connections may carry the id as a
 * JWT subject string, while the DB stores it as an integer.
 */
export function resolveWsUserId(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isInteger(n) ? n : null;
}
```

- [ ] **Step 4:跑测试确认通过**

Run: `cd /home/admin/files/projects/claude-ui && npx vitest run server/shared/utils.ownership.test.ts`
Expected: PASS(5/5)。

- [ ] **Step 5:跑 tsc 确认 0 error**

Run: `cd /home/admin/files/projects/claude-ui && npx tsc --noEmit`
Expected: 0 error。

---

## Task 4:修 bug-1 —— `updateCustomProjectNameById` SQL 绑定 + 加 userId

**Files:**
- Modify: `server/modules/database/repositories/projects.db.ts:133-140`
- Test: `server/modules/database/repositories/projects.db.integration.test.ts`(或现有 projects.db 测试)

**Interfaces:**
- Produces: `updateCustomProjectNameById(projectId: string, customProjectName: string | null, userId: number): void`(userId 改必填)

- [ ] **Step 1:写失败测试(改名只生效于本人 + 不串用户)**

在 projects.db.integration.test.ts 加:
```ts
it('updateCustomProjectNameById only renames the owning user row', () => {
  const { getConnection } = require('../../../../test-helpers/db.js'); // 用现有 withIsolatedDatabase 模式
  // 建两个用户 + 两个项目(同 path 不同 user)
  // ... 用现有测试 setup 模式建 user1/id=1, user2/id=2 与各自 project
  projectsDb.createProjectPath('/proj', 1);
  projectsDb.createProjectPath('/proj', 2);
  projectsDb.updateCustomProjectNameById('proj-id-1', 'name1', 1);
  expect(projectsDb.getCustomProjectName('proj-id-1', 1)).toBe('name1');
  // user2 改 user1 的 projectId 不应生效
  projectsDb.updateCustomProjectNameById('proj-id-1', 'hijack', 2);
  expect(projectsDb.getCustomProjectName('proj-id-1', 1)).toBe('name1');
});
```
> 注:用现有集成测试的 `withIsolatedDatabase` + 建 user 的 setup(阶段6 已建过 id=1 测试 user,这里补 id=2)。具体 setup 仿照现有用例。

- [ ] **Step 2:跑测试确认失败**

Run: `npx vitest run server/modules/database/repositories/projects.db.integration.test.ts`
Expected: FAIL(SQL 绑定错误或方法签名不匹配)。

- [ ] **Step 3:修方法**

`server/modules/database/repositories/projects.db.ts` L133-140,把:
```ts
updateCustomProjectNameById(projectId: string, customProjectName: string | null): void {
    const db = getConnection();
    db.prepare(`
        UPDATE projects
        SET custom_project_name = ?
        WHERE project_id = ? AND user_id = ?
    `).run(customProjectName, projectId);
},
```
改为:
```ts
updateCustomProjectNameById(projectId: string, customProjectName: string | null, userId: number): void {
    const db = getConnection();
    db.prepare(`
        UPDATE projects
        SET custom_project_name = ?
        WHERE project_id = ? AND user_id = ?
    `).run(customProjectName, projectId, userId);
},
```

- [ ] **Step 4:跑 tsc 找出所有受影响调用点**

Run: `npx tsc --noEmit`
Expected: 在 `project-management.service.ts:145` 报 `updateCustomProjectNameById` 缺第 3 参(Task 5 会修)。

- [ ] **Step 5:跑测试确认通过**

Run: `npx vitest run server/modules/database/repositories/projects.db.integration.test.ts`
Expected: PASS(含新用例)。

---

## Task 5:projects service 层透传 userId(P1/P2/P3/P4a/P5/P6)+ 去 `=1` 默认值

**Files:**
- Modify: `project-delete.service.ts:58,73,81`(P1/P2)
- Modify: `project-star.service.ts:57,66,75`(P3)
- Modify: `project-management.service.ts:143-146`(P4a)
- Modify: `projects-with-sessions-fetch.service.ts:144-162,295-316`(P5/P7)
- Modify: `projects-has-taskmaster.service.ts:205-208,227-248`(P6)

**Interfaces:** 所有 by-id service 方法 `userId: number = 1` → `userId: number`(必填)

**模式(适用于 P1-P6 所有改动点)**:把 service 内漏传的 userId 透传给已带 `AND user_id = ?` 的 db 方法;非属主查不到行自然 404。不需要 assertOwns(projects 底层已隔离)。

- [ ] **Step 1:写失败测试(跨用户隔离)**

在 project-management / project-star / project-delete 的集成测试里,各加一个 A/B 用户用例(模式):
```ts
it('toggle-star: user2 cannot star user1 project (no-op, stays)', () => {
  // 建 user1 project P, user2 无此 project
  // user2 调 toggleProjectStar(P, 2)
  // 期望:user1 的 P.isStarred 不变(因为 getProjectById(P,2) 返回 null → 抛 404)
  expect(() => toggleProjectStar(P_ID, 2)).toThrow(AppError);
  expect(projectsDb.getProjectById(P_ID, 1).isStarred).toBe(false);
});
```
对 delete/restore/rename/sessions-page/taskmaster 各加一个同类用例(非属主抛 404 + 本人数据不变)。

- [ ] **Step 2:跑测试确认失败**

Run: `npx vitest run server/modules/projects`
Expected: FAIL(当前 service 漏传 userId,非属主也能命中)。

- [ ] **Step 3:P1/P2 改 project-delete.service.ts**

L58 `deleteOrArchiveProject(projectId, force, userId: number = 1)` → `userId: number`,且:
- L59:`projectsDb.getProjectById(projectId)` → `projectsDb.getProjectById(projectId, userId)`
- L73:`sessionsDb.deleteSessionsByProjectPath(row.project_path)` → `sessionsDb.deleteSessionsByProjectPath(row.project_path, userId)`

L80 `restoreArchivedProject(projectId, userId: number = 1)` → `userId: number`,且:
- L81:`projectsDb.getProjectById(projectId)` → `projectsDb.getProjectById(projectId, userId)`

- [ ] **Step 4:P3 改 project-star.service.ts**

L57 `toggleProjectStar(projectId, userId: number = 1)` → `userId: number`,且:
- L66:`projectsDb.getProjectById(normalizedProjectId)` → `projectsDb.getProjectById(normalizedProjectId, userId)`
- L75:`projectsDb.updateProjectIsStarredById(normalizedProjectId, nextStarredState)` → `projectsDb.updateProjectIsStarredById(normalizedProjectId, nextStarredState, userId)`

L33 `applyLegacyStarredProjectIds(projectIds, userId: number = 1)` → `userId: number`(L38/L47 已传,仅去默认值)。

- [ ] **Step 5:P4a 改 project-management.service.ts**

L143 `updateProjectDisplayName(projectId, userId: number = 1, newDisplayName)` → `userId: number`,body 改为:
```ts
export function updateProjectDisplayName(projectId: string, userId: number, newDisplayName: unknown): void {
  const row = projectsDb.getProjectById(projectId, userId);
  if (!row) {
    throw new AppError(`Unknown projectId: ${projectId}`, { code: 'PROJECT_NOT_FOUND', statusCode: 404 });
  }
  const trimmed = typeof newDisplayName === 'string' ? newDisplayName.trim() : '';
  projectsDb.updateCustomProjectNameById(projectId, trimmed.length > 0 ? trimmed : null, userId);
}
```

- [ ] **Step 6:P5/P7 改 projects-with-sessions-fetch.service.ts**

- `getProjectSessionsPage(projectId, options)` 签名改为接受 userId:
```ts
export async function getProjectSessionsPage(
  projectId: string,
  options: SessionPaginationOptions & { userId: number },
): Promise<ProjectSessionsPageApiView> {
  const projectRow = projectsDb.getProjectById(projectId, options.userId);
  if (!projectRow) throw new AppError(`Project "${projectId}" was not found.`, { code: 'PROJECT_NOT_FOUND', statusCode: 404 });
  const sessionsPage = readProjectSessionsPageByPath(projectRow.project_path, options.userId, options);
  // ...(后续不变)
}
```
- `readProjectSessionsPageByPath(projectPath, userId: number = 1, options)` → `userId: number`,且:
  - L150:`sessionsDb.getSessionsByProjectPathPage(projectPath, pagination.limit, pagination.offset)` → 追加 `, userId`
  - L155:`sessionsDb.countSessionsByProjectPath(projectPath)` → 追加 `, userId`

- [ ] **Step 7:P6 改 projects-has-taskmaster.service.ts**

- 类型 `GetProjectTaskMasterResolver` 加 userId:`(projectId: string, userId: number) => ...`
- `defaultDependencies.resolveProjectPathById` L206:`projectsDb.getProjectPathById(projectId, 1)` → `(projectId: string, userId: number) => projectsDb.getProjectPathById(projectId, userId)`
- `getProjectTaskMaster(projectId, resolveById)` → `getProjectTaskMaster(projectId: number, userId, resolveById = getProjectTaskMasterById)`,内部 `resolveById(normalizedProjectId, userId)`
- `getProjectTaskMasterById` 加 `userId` 参数并透传给 resolver

- [ ] **Step 8:跑 tsc 找全调用点**

Run: `npx tsc --noEmit`
Expected: 报 projects.routes.ts L93/L221(Task 6 修)。

- [ ] **Step 9:跑 projects 测试确认通过**

Run: `npx vitest run server/modules/projects`
Expected: PASS(含新越权用例)。

---

## Task 6:projects 路由层补 requireUserId(P5/P6)

**Files:**
- Modify: `server/modules/projects/projects.routes.ts:93-102`(P5 sessions)、`221-228`(P6 taskmaster)

**Interfaces:** 消费 Task 5 的 service 新签名(必填 userId)

- [ ] **Step 1:P5 路由 L93-102 传 userId**

`GET /:projectId/sessions` handler,把:
```ts
const result = await getProjectSessionsPage(projectId, { limit, offset });
```
改为:
```ts
const userId = requireUserId(req);
const result = await getProjectSessionsPage(projectId, { limit, offset, userId });
```

- [ ] **Step 2:P6 路由 L221-228 传 userId**

`GET /:projectId/taskmaster` handler,把:
```ts
const result = await getProjectTaskMaster(projectId);
```
改为:
```ts
const userId = requireUserId(req);
const result = await getProjectTaskMaster(projectId, userId);
```
(确认 `requireUserId` 已 import;P3/P4/P1/P2 的路由 L234/245/254/269 之前已传,无需改。)

- [ ] **Step 3:跑 tsc 0 error**

Run: `npx tsc --noEmit`
Expected: 0 error。

- [ ] **Step 4:跑 build 确认**

Run: `NODE_OPTIONS=--max-old-space-size=2048 npm run build`
Expected: EXIT 0。

---

## Task 7:sessions 路由层 S2-S5 加 assertOwnsSession

**Files:**
- Modify: `server/modules/providers/provider.routes.ts:562-633`(S2 DELETE / S3 restore / S4 PUT rename / S5 GET messages)

**Interfaces:** 消费 Task 3 的 `assertOwnsSession` + `requireUserId`;`sessionsDb.getSessionById`

**模式**:每个 handler 在 `parseSessionId` 之后加:
```ts
const userId = requireUserId(req);
const session = sessionsDb.getSessionById(sessionId);
assertOwnsSession(session, userId);
```
(需要 import `assertOwnsSession` from `@/shared/utils.js` 与 `sessionsDb` from `@/modules/database/index.js`,后者应已 import。)

- [ ] **Step 1:写失败测试(S3 restore 越权,作代表)**

在 sessions-provider-mapping 或新建 provider.routes 越权测试里:
```ts
it('POST /api/providers/sessions/:sid/restore: user2 cannot restore user1 session', async () => {
  // user1 建 session S, user2 登录态调 restore S
  const res = await request(app).post(`/api/providers/sessions/${S}/restore`).set('Authorization', user2Token);
  expect(res.status).toBe(404);
  // user1 的 session 状态未变
});
```
对 S2/S4/S5 各加一个同类(DELETE/PUT/GET messages 越权 → 404)。

- [ ] **Step 2:跑测试确认失败**

Run: `npx vitest run server/modules/providers`
Expected: FAIL(当前无 ownership,返回 200)。

- [ ] **Step 3:S2 DELETE `/sessions/:sessionId`(L562-575)加校验**

handler 体首行(parseSessionId 之后)插:
```ts
const userId = requireUserId(req);
assertOwnsSession(sessionsDb.getSessionById(sessionId), userId);
```
再 `await sessionsService.deleteOrArchiveSessionById(sessionId, { force, deletedFromDisk });`

- [ ] **Step 4:S3 restore(L577-584)、S4 PUT rename(L586-594)、S5 GET messages(L596-633)同模式加校验**

每个 handler 在解析 sessionId 之后、调 service 之前插同样的 3 行。S5 放在 limit/offset 解析之前(避免对无权 session 还做 400 校验)。

- [ ] **Step 5:跑测试确认通过**

Run: `npx vitest run server/modules/providers`
Expected: PASS(越权用例返 404)。

- [ ] **Step 6:跑 tsc 0 error**

Run: `npx tsc --noEmit`
Expected: 0 error。

---

## Task 8:S6(gemini.js)+ S7(index.js token-usage)加 assertOwnsSession

**Files:**
- Modify: `server/routes/gemini.js:8-23`(S6)
- Modify: `server/index.js:1164-1182`(S7)

- [ ] **Step 1:写失败测试**

- S6:`DELETE /api/gemini/sessions/:sid` user2 删 user1 session → 404 + 未删
- S7:`GET /api/projects/:pid/sessions/:sid/token-usage` user2 读 user1 → 404

- [ ] **Step 2:跑测试确认失败**

Run: 跑对应测试文件
Expected: FAIL。

- [ ] **Step 3:S6 改 gemini.js**

在格式校验 if 块之后(L14 后)、`sessionManager.deleteSession` 之前插:
```js
const { requireUserId, assertOwnsSession } = await import('../shared/utils.js');
// 或顶部 import(requireUserId / assertOwnsSession from '../shared/utils.js')
const userId = requireUserId(req);
const session = sessionsDb.getSessionById(sessionId);
try { assertOwnsSession(session, userId); }
catch (e) { return res.status(404).json({ success: false, error: 'Session not found' }); }
```
(注:gemini.js 用 `{ success, error }` 响应 shape,不靠 asyncHandler 错误中间件;所以 catch AppError 后手动返 404。顶部加 `import { requireUserId, assertOwnsSession } from '../shared/utils.js';`)

- [ ] **Step 4:S7 改 index.js token-usage**

L1182(`!sessionRow` 404 块之后)插:
```js
const { assertOwnsSession } = await import('./shared/utils.js'); // 或顶部 import
// requireUserId 已有 authenticateToken,直接读 req.user.id
const userId = Number(req.user?.id);
try { assertOwnsSession(sessionRow, userId); }
catch (e) { return res.status(404).json({ error: 'Session not found', sessionId: safeSessionId }); }
```
(顶部加 `import { assertOwnsSession } from './shared/utils.js';`,用同步 import 而非动态。)

- [ ] **Step 5:跑测试确认通过 + tsc(若 index.js/gemini.js 在 checkJs 范围)**

Run: `npx vitest run` + `npx tsc --noEmit`
Expected: PASS / 0 error。

---

## Task 9:S1 WS `chat.send` 加 assertOwnsSession

**Files:**
- Modify: `server/modules/websocket/services/chat-websocket.service.ts:107-181`

**Interfaces:** 消费 Task 3 的 `resolveWsUserId` + `assertOwnsSession`

- [ ] **Step 1:写失败测试(WS 越权)**

在 chat-run-registry.test 或新建 ws 越权测试:
```ts
it('WS chat.send: user2 cannot run on user1 session', async () => {
  // user1 建 session S;用 user2 的 ws 连接发 {type:'chat.send', sessionId:S}
  // 期望:收到 SESSION_NOT_FOUND protocol error;无 CLI 启动(chatRunRegistry 不含 S)
});
```

- [ ] **Step 2:跑测试确认失败**

Run: `npx vitest run server/modules/websocket`
Expected: FAIL。

- [ ] **Step 3:改 handleChatSend**

`chat-websocket.service.ts` L107-128,在 `const session = sessionsDb.getSessionById(sessionId);` 与 `if (!session)` 块之后(L128 附近)插 ownership 校验:
```ts
import { assertOwnsSession, resolveWsUserId } from '@/shared/utils.js'; // 顶部加

// handleChatConnection L330: const userId = resolveWsUserId(readRequestUserId(request));
//   (把原来 string|number|null 的 userId 归一为 number|null)

// handleChatSend 内,L128 if(!session) 块之后:
if (userId === null) {
  sendProtocolError(ws, 'SESSION_NOT_FOUND', 'Session not found');
  return;
}
try {
  assertOwnsSession(session, userId);
} catch {
  sendProtocolError(ws, 'SESSION_NOT_FOUND', 'Session not found');
  return;
}
```
(用 `SESSION_NOT_FOUND` 不用 FORBIDDEN,与现有 `!session` 分支一致,不泄露存在性。)

- [ ] **Step 4:跑测试确认通过**

Run: `npx vitest run server/modules/websocket`
Expected: PASS。

- [ ] **Step 5:跑 tsc 0 error**

Run: `npx tsc --noEmit`
Expected: 0 error。

---

## Task 10:越权测试补全 + 全量回归

**Files:** Task 5/7/8/9 已加的测试文件

- [ ] **Step 1:核对越权用例覆盖矩阵**

确认每个 destructive 端点都有 A/B 用户用例:
- sessions: S1 chat.send、S2 DELETE、S3 restore、S4 rename、S5 messages、S6 gemini DELETE、S7 token-usage
- projects: P1 DELETE、P2 restore、P3 toggle-star、P4 rename、P5 sessions list、P6 taskmaster
- bug 回归:updateCustomProjectNameById 生效、P5/P6 非 user-1 拿到自己数据

缺的补上(模式同 Task 5 Step 1)。

- [ ] **Step 2:全量 build + test**

Run:
```bash
cd /home/admin/files/projects/claude-ui
NODE_OPTIONS=--max-old-space-size=2048 npm run build 2>&1 | tail -5
npm test 2>&1 | tail -15
```
Expected: build EXIT 0;test 全绿(原 36 + 新增越权用例)。

---

## Task 11:C3 提交加固

**Files:** Task 3-10 改动的所有文件 + 测试

- [ ] **Step 1:stage 加固改动(不含设计系统线)**

Run:
```bash
cd /home/admin/files/projects/claude-ui
git add server/shared/utils.ts \
  server/modules/database/repositories/projects.db.ts \
  server/modules/projects/services/ \
  server/modules/projects/projects.routes.ts \
  server/modules/providers/provider.routes.ts \
  server/routes/gemini.js \
  server/index.js \
  server/modules/websocket/services/chat-websocket.service.ts \
  server/shared/utils.ownership.test.ts
# 加测试文件(modified 的集成测试)
git add -u
```

- [ ] **Step 2:确认无设计系统线混入**

Run: `git diff --cached --name-only | grep -E 'docs/|playground/|server/index.mjs|src/pages/|src/main.tsx|tailwind'`
Expected: 空输出。

- [ ] **Step 3:提交 C3**

Run:
```bash
git commit -m "fix(claude-ui): 多用户 by-id 越权加固(阶段7)+ SQL 绑定/硬编码 userId 修复

- shared/utils: 新增 assertOwnsSession(404,不泄露存在性)+ resolveWsUserId
- sessions 侧 S1-S7(WS chat.send / provider DELETE·restore·rename·messages / gemini DELETE / token-usage):调用点 assertOwnsSession
- projects 侧 P1-P6:service 层透传 userId(getProjectById 等底层已带 AND user_id);去 by-id 默认值 =1
- bug-1: updateCustomProjectNameById 补第 3 个 SQL 绑定 + 加 userId 形参
- bug-2: getProjectSessionsPage / getProjectTaskMaster 去硬编码 userId=1
- 测试: 13 个越权端点 A/B 用户用例 + bug 回归

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 12:部署 cloudcli + 冒烟

**Files:** 无(部署操作)

- [ ] **Step 1:重启 siteboon 后端**

Run:
```bash
sudo systemctl restart cloudcli.service
sleep 3
systemctl status cloudcli.service --no-pager | head -6
```
Expected: `active (running)`,Main PID 刷新,内存稳定(~600M)。

- [ ] **Step 2:本机冒烟**

Run:
```bash
curl -s http://127.0.0.1:3001/api/auth/status -H 'Host: hermes.cy-pharm.com' | head -c 200
```
Expected: 200 + JSON(needsSetup:false 或用户态)。

- [ ] **Step 3:外部入口冒烟(xms-161 测 8080/claude/)**

Run(在 hermes 本机走 ssh 或直接 curl 8080):
```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/claude/api/auth/status -H 'Host: hermes.cy-pharm.com'
```
Expected: `200`。

- [ ] **Step 4:手动验一个越权端点(可选,登录两账号)**

如条件允许,登录 user A/B,用 B 的 token 访问 A 的 session detail → 应 404。否则依赖 Task 10 的自动化测试。

---

## Self-Review(写完后自查)

**1. Spec 覆盖**:
- S1-S7 → Task 7(S2-S5)/ Task 8(S6,S7)/ Task 9(S1)✅
- P1-P7 → Task 5(service 透传 P1-P6)/ Task 6(路由 P5,P6);P7 随 P5(readProjectSessionsPageByPath)✅
- bug-1 → Task 4 ✅;bug-2 → Task 5 Step 6(P5)+ Step 7(P6)✅
- 提交 C1/C2/C3 → Task 1/2/11 ✅
- 测试 + 部署 → Task 10/12 ✅
- 404 统一 → assertOwnsSession + projects 底层 404 ✅

**2. Placeholder**:无 TBD;每个改动给 old→new 代码;测试给模式 + 代表用例 + 覆盖矩阵。gemini.js/index.js 的 import 形式标注了"顶部加 import"(具体路径给全)。

**3. 类型一致**:`assertOwnsSession(session, userId)` 全程一致;`resolveWsUserId` 返回 `number | null`;service 方法 `userId: number`(必填,去默认值)在 Task 5 定义、Task 6 消费,签名匹配。

**4. 已知风险/边界**:
- gemini.js/index.js 是 .js(checkJs 可能 false,tsc 不报),Task 8 的 import 笔误只会在运行时暴露 → Step 5 同时跑 tsc + 集成测试兜底。
- WS chat.send 测试需搭 ws 客户端 mock,Task 9 Step 1 是最复杂的测试搭建点。
- Task 0 若 build 不过(UsersTab 等),优先修 build,否则 C1 会提交坏代码 —— Task 0 Step 2 是硬门禁。
