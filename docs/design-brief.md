# Claude UI · Design Brief

> 用 frontend-design 的方法论给本项目定下"非模板化"的设计语言。

## Subject(被设计对象)
一台 **AI 工作台** —— 让我(Claude)把日常产出的对话、任务、报表、表单沉淀为可复用的视觉语言。
受众:我自己 + 偶尔来看产出的人。
单一职责:让"AI 生成的界面"看起来像有人认真打磨过,而不是 v0 / shadcn-default 拼出来的。

## Avoid(明确要避开的 AI-slop 模式)
- 奶油底(#F4F1EA) + 高对比衬线 + 赤陶橙
- 近黑底 + 一抹荧光绿/朱砂红
- Broadsheet 风密集报刊栏
- 全站统一大圆角 + Inter + 紫色渐变
- 居中 hero + 大数字 + 小标签 + 三张等宽卡片

## Palette(取自"工作台"的 vernacular)
不走"科技感",走**冷峻纸面**:像草稿本+晒图机。
| Token       | Hex        | 用途                          |
|-------------|------------|-------------------------------|
| ink         | `#13161A`  | 正文/标题                     |
| paper       | `#F5F3EE`  | 默认底色(略偏暖灰,非奶油)    |
| graphite    | `#5A6068`  | 次要文字                      |
| rule        | `#C9C5BC`  | 1px 分割线、表格线            |
| accent-blue | `#2E4BD0`  | 唯一强调色(链接/CTA/活跃态) |
| signal-amber| `#C97A1F`  | 极少量警示/数字注解           |

暗色基于同一组语义,翻转明度即可。

## Typography
两套字族,刻意**不**用 Inter:
- **Display**:`"IBM Plex Serif", "Source Han Serif SC", serif` —— 标题/Hero,带制图味
- **Body**:`"IBM Plex Sans", "PingFang SC", system-ui, sans-serif`
- **Mono / 数据**:`"IBM Plex Mono", ui-monospace`

字号阶梯(rem):0.75 / 0.8125 / 0.875 / 1 / 1.125 / 1.375 / 1.75 / 2.25 / 3。
正文行高 1.65,标题 1.15;字距标题 -0.01em,小字 0.02em。

## Layout & Structure
- 12 栏栅格,gutter 24,内容最大宽 1200,文档页最大 720
- **没有大圆角**:卡片 6px,按钮 4px,输入框 4px
- **1px hairline rule** 是主结构语言(不是阴影,也不是 border-2)
- 锚点编号只在"真的是序列"时才用(路线图、流程),不当装饰

## Signature(本项目要让人记住的那一件事)
**左侧贴边的"刻度尺"导航条** —— 一条带刻度线的 24px 窄栏,显示当前章节在整页中的位置,像绘图板侧边的标尺。
所有页面共用,是 claude-ui 的视觉印记。

## Motion
克制。仅 3 处:
1. 页面进入时,刻度尺从顶向下"墨水滴落"式描出(300ms,prefers-reduced-motion 关闭)
2. 链接 hover 时下划线从左展开 120ms
3. Toast 入场用 16ms 的硬切,**不**用弹簧

## Voice / Copy
- 动词领头("保存更改",不要"提交")
- 错误说出**发生了什么**和**怎么修**,不道歉
- 空态是邀请行动,不是抒情

## 自检清单(写代码前打 ✅)
- [ ] 颜色不是上面列的三种 AI-slop 之一
- [ ] 标题字体不是 Inter
- [ ] 圆角没有全站统一
- [ ] hero 不是"大数字+小标签+三卡片"
- [ ] 至少有一个 signature 元素被实现
