# Handoff — claude-ui

> 最后更新: 2026-09-22 15:32 (CC,job-20260922-145732)
> 用途: 换会话时秒回状态。新会话进项目**先读本文件**;再次 /handoff 时旧版自动归档到 handoff_history/。

## 当前状态:**已修复、已验证、在线**
2026-09-22 磊哥报『网页里没法讲话』(点项目无响应→永远停在 Choose Your Project→无输入框)。当日已恢复,3001 与 8080(磊哥 nginx 入口)双通道 E2E 验证全链路通:点项目→开会话→输入→发送→模型响应,零 pageerror。🎤语音悬浮按钮保留。

## 事故结论(根因链)
1. **直接死因**:线上 dist 是 8-31 语音会话重建的 `index-DC5lgylu.js`,该 bundle 点项目行不触发任何 API/DOM 变化(8-31 会话只验收了落地页🎤,没回归"点项目→聊天"主路径)。
2. **A/B 铁证**:换回 8-12 构建的 `index-qym-iWte.js`(dist.bak-before-voice-20260831/)全链路立即正常 → 排除服务端/网络/WS。
3. **修复动作(15:14-15:18 由并行 CC 实例完成,本实例独立验证)**:vite.config.js `base: './'→'/'` + `cloudcli update`(服务端 1.36.0→1.37.3)+ 重建(现役 bundle `index-D7tZJKEx.js`)+ 15:18:42 重启 cloudcli.service。
4. **疑似双通道重复派单**:本工单同时走了 task-jobs 与 zmem auto-act 两条通道,两个 headless CC 在同一工作树并行干活(幸未互相破坏,但有此风险)。

## ⚠️ 铁律修订(覆盖 8-31 旧铁律)
- ~~"前端构建只用 build:client,base 必须 './'"~~ → **现役正确配置是 `base: '/'`**(v1.37.3 客户端 + base='/' 已实测工作;'./' 时代的 8-31 反而是坏的)。构建仍只用 `npm run build:client`,绝不用 build:ui(=vite.config.ts,base=/claude/,白屏)。
- 旧教训仍有效:改 base 必须先备份 dist + vite.config.js,改完必须回归"点项目→发消息"主路径,不能只看落地页。

## 备份地图(2026-09-22 现状,勿乱删)
| 目录 | 内容 | 状态 |
|---|---|---|
| `dist/`(index-D7tZJKEx.js) | 现役,v1.37.3 客户端 | ✅ 在线验证通过 |
| `dist.bak-before-basefix-20260922/`(qym-iWte) | 8-12 旧可用构建(并行者留) | 可用回退 |
| `dist.bak-test-20260922/`(DC5lgylu) | 8-31 **坏**构建(本会话留证) | 勿再上线 |
| `dist.bak-before-voice-20260831/`(qym-iWte) | 8-12 旧可用构建 | 可用回退 |
| `vite.config.js.bak-relative-base-20260922` | base='./' 旧配置备份 | 留证 |

## E2E 验证脚手架(下次直接用)
- 脚本:`/home/admin/tmp/cui_verify_final.py <入口URL> <tag>`(自签 JWT=app_config.jwt_secret 签 {userId:1,username:'admin'},localStorage['auth-token'],Playwright 全链路)
- **选择器铁坑**:侧边栏每个项目渲染移动端+桌面端两份 DOM,`text=.claude` 的 first 永远是隐藏副本——必须用 `text=.claude >> visible=true`。
- 服务刚重启后 /api/projects 冷启动慢,必须 `wait_for_selector` 等列表出来再操作。

## 别踩的坑(沿旧版)
- 运行时 DB 是 `/home/admin/.cloudcli/auth.db`(users 表:1=admin 磊哥、15=cjj、16=LinC);JWT secret 用完整 128 字符。
- 改 server 代码要 `npm run build:server && npm run build:client && sudo systemctl restart cloudcli.service`;纯前端只 build:client 免重启。
- 服务自带 auto-updater 会自己跑 git pull + npm install(日志 grep "Starting system update");上游有新版时侧栏会亮 "Update available"。
- `/home/admin/.claude/commands/profile.md` YAML frontmatter 有语法错,服务端每次解析都刷 "Error parsing command file"(已知噪音,不影响功能,待修:第3行冒号)。

## 未完事项
- 无阻塞。可选:① 侧栏 "Update available" 角标(上游有新版,非本事故范围) ② 清理 4 份 dist 备份(确认稳定一周后) ③ profile.md frontmatter 修复。
- 相关 memory:[[claude-ui-base-config-and-e2e-20260922]](本机 memory 库)
