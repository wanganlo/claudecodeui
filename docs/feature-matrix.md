# Claude UI 功能矩阵

| Claude Code CLI | 网站等价 |
|---|---|
| `claude` 交互 | `/chat` Chat 模式 + `/chat` CLI 模式(走 `claude -p --bare`) |
| `claude -p prompt` | `/code` CLI 执行,`/workbench` CLI 区流式 |
| `claude --model X --effort low` | 顶栏 model 输入框 + effort 下拉 |
| `claude agents` | `/code` Agents Tab(实时 polling 5s) |
| `claude mcp list` / `get` | `/code` MCP Tab + 点开详情抽屉 |
| `~/.claude/jobs` | `/code` Jobs Tab + Timeline 抽屉 |
| `~/.claude/skills` | `/code` Skills Tab + SKILL.md 渲染抽屉 |
| `~/.claude/projects/*.jsonl` | `/code` Sessions Tab + 详情抽屉 |
| `~/.claude/settings.json` | `/code` Config Tab |
| `~/.claude/daemon.status.json` | `/code` Overview |
| 终端 git/ls/cat | `/workbench` Shell 区(命令历史 ↑↓) |
| git diff | `/workbench` Git 区(diff 着色) |
| 文件读写 | `/workbench` 多 Tab 编辑器 + 文件树 hover 删除 |
| logs | `/logs` 页:service/daemon/nginx 三源 + 8s 自动刷新 |
| 组件文档站 | `/docs`:左侧导航(按 Action/Form/Container/Display/Overlay/Data/State 分组) + 右侧 Demo/Code 切换 + Props 表 + 一键复制 |
| ⌘K 跳转 | 全局命令面板(覆盖 Home/Components/Chat/Dashboard/Code/Workbench/Docs) |

## Codex 体感对齐
- 三栏:文件树 / 多 Tab 编辑器 / 协作面板(CLI · Shell · Git)
- ⌘/Ctrl+S 保存,⌘/Ctrl+Enter 运行 CLI
- 流式 stdout 实时刷,可中止 / 复制
- Git diff 颜色化(+ 绿 / - 红 / @@ 蓝)
- Shell 终端会话化,命令历史 ↑/↓

## 安全模型
- 后端只在 `127.0.0.1:9181`,nginx 公网反代
- API key 仅服务端 systemd Environment,不下发浏览器
- fs 读写、shell 严格沙箱在 `$HOME` 之内
- nginx 静态 alias `/var/www/claude` + SPA fallback

## 部署
- `bash scripts/deploy.sh`(build → cp dist → smoke test)
- systemd: `claude-ui-server.service`(active, autorestart)
- 公网入口: `https://hermes.cy-pharm.com:9080/claude/`
