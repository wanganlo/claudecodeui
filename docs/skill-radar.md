# Skill Radar · UI 建设相关跨市场扫描

> 通过 `cross-marketplace-skill-search` 在 5 站(实际 API 仅 agentskill.sh 可用)按
> 关键词扫描的高分技能;未来需要更进一步能力时,直接挑这里的装。

## 已锁定的本地可用技能(ready)
| Skill                    | 用途                                       |
|--------------------------|--------------------------------------------|
| frontend-design          | 设计 brief 方法论(已用于 design-brief.md) |
| theme-factory            | 10 套预设主题(已接 2 套到 src/styles)     |
| web-artifacts-builder    | shadcn/ui 40+ 组件脚手架(已建 playground)|
| doc-designer             | 业务表单/公文 HTML 排版(留作 M2)          |
| cross-marketplace-skill-search | 跨市场搜技能(本表来源)              |

## 候选(按需安装,质量分 q ≥ 75)

### UI/UX 设计智能
- **ipai-ui-ux-pro-max** (q=92) — `diegosouzapw/awesome-omni-skill` — UI/UX 生成与评审,正是 doc-designer 引用却本地缺失的那个
- **ui-ux-pro-max-v3** (q=75) — 同源 v3
- **ui-ux-designer-v2** (q=75)

### shadcn/ui 工程化
- **shadcn** (q=100) — `pedronauck/skills` ★404 — 构建 shadcn/ui 组件最佳实践,质量分顶格
- **shadcn** (q=75) — `bytesagain/ai-skills` — shadcn 参考工具

### Tailwind / 设计系统
- **tailwind-patterns-v2** (q=92) — Tailwind CSS v4 (2025) 模式
- **design-system-creator** (q=92) — `majiayu000/claude-skill-registry` ★106 — 构建完整设计系统与 design bible
- **tailwind-design-system-v2** (q=75)
- **radix-ui-design-system-v2** (q=67)

### 数据可视化
- **chart** (q=92) — `aws-samples/sample-aws-idp-pipeline` — Matplotlib 数据图表
- **chart-designer** (q=75) — 数据可视化设计
- **analytics-dashboard-design** (q=100) — CRM Analytics 看板设计(偏 Salesforce,参考价值有限)

## 推荐安装顺序(按需触发)
1. 立刻装:**shadcn (q=100, pedronauck)** —— 写组件时强力外援
2. M1 阶段装:**ipai-ui-ux-pro-max** + **design-system-creator** —— 评审/沉淀设计系统
3. M2 看板需要时:**chart-designer**
