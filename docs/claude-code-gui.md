# Claude Code GUI 功能清单

访问: `https://hermes.cy-pharm.com:9080/claude/code`

## 已实现
- **总览**:模型、Agents、Jobs、Skills、MCP、Sessions 汇总 + daemon 状态
- **CLI 执行**:网页调用 `claude -p --bare`,支持 prompt 与额外 flags
- **Agents**:读取 `claude agents --json`,展示 kind/status/cwd/session/pid
- **Jobs**:读取 `~/.claude/jobs/*/state.json + timeline.jsonl`,展示状态、意图、事件数、更新时间,支持搜索
- **Skills**:读取 `~/.claude/skills/*/SKILL.md`,展示描述、文件数、更新时间,支持搜索
- **MCP**:读取 `claude mcp list`,展示 server、命令、审批/健康状态
- **Sessions**:读取 `~/.claude/projects/**/*.jsonl`,展示会话文件、项目、大小、修改时间
- **Config**:展示 `~/.claude/settings.json` 与 `daemon.status.json`
- **Chat**:真实 ARK/Claude SSE 流式聊天,保留 localStorage 会话历史

## 后端接口
- `GET /claude/api/status`
- `GET /claude/api/agents`
- `GET /claude/api/jobs`
- `GET /claude/api/skills`
- `GET /claude/api/mcp`
- `GET /claude/api/sessions`
- `GET /claude/api/config`
- `GET /claude/api/daemon`
- `POST /claude/api/run` → `{ prompt, flags?, timeout? }`
- `POST /claude/api/chat` → SSE stream

## 服务
- systemd: `claude-ui-server.service`
- local: `127.0.0.1:9181`
- nginx: `/claude/api/` → `http://127.0.0.1:9181/api/`

## 安全说明
- API Key 仅存在 systemd 服务环境变量,不会下发到浏览器。
- `/api/run` 当前允许网页执行 `claude -p --bare`;后续可加 token/白名单/审计。

## V3 工作台 (`/claude/workbench`)
- **Claude CLI 流式**:`POST /api/cli/stream` SSE,直接调本机 `claude -p --bare`,支持 cwd / model / effort / addDirs / tools
- **Shell**:`POST /api/shell`,在 $HOME 范围内执行命令并返回 stdout/stderr
- **文件浏览/读写**:`/api/fs/list`、`/api/fs/read`、`/api/fs/write`,严格限制在 $HOME
- **Git**:`/api/git/status?dir=`,聚合 status/branch/log
- **Job Timeline**:`/api/jobs/timeline?id=` 拉取 ~/.claude/jobs/<id>/timeline.jsonl 最近 300 行
