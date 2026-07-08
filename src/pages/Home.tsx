import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Badge } from '@/components'

const STATS = [
  { k: '基础组件', v: 12 },
  { k: '主题', v: 3 },
  { k: '模板页', v: 6 },
  { k: '部署', v: '/claude/' },
]

const PILLARS = [
  { t: '组件', d: 'Button / Input / Textarea / Card / Badge / Modal / Toast / Table / Ruler', to: '/components' },
  { t: '对话', d: '专为 AI 对话设计的双栏布局,流式输入与历史会话管理。', to: '/chat' },
  { t: '看板', d: '指标 + 表格 + 状态徽章,作为运营报表的范式起点。', to: '/dashboard' },
  { t: 'Claude Code GUI', d: 'CLI、Agents、Jobs、Skills、MCP、Sessions 的统一控制台。', to: '/code' },
  { t: 'Workbench', d: '流式 CLI、Shell、文件编辑、Git 状态,接近 Codex 的工作台体验。', to: '/workbench' },
]

export default function Home() {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-muted">v0.3 · 可用化(状态/持久化/响应式/a11y)</p>
      <h1 className="mt-3 text-4xl md:text-5xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display, ui-serif)' }}>
        我的 UI 工作台
      </h1>
      <p className="mt-4 text-muted leading-relaxed max-w-[640px]">
        沉淀属于自己的组件、模板与设计语言。每一次交付都更稳、更快、更克制 ——
        把 AI 生成的界面,做得不像 AI 生成的。
      </p>

      <section className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-px bg-rule/60 border border-rule">
        {STATS.map(s => (
          <div key={s.k} className="bg-bg p-5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted">{s.k}</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">{s.v}</div>
          </div>
        ))}
      </section>

      <section className="mt-12">
        <div className="flex items-baseline gap-3">
          <h2 className="text-xl font-semibold">三件事</h2>
          <Badge tone="brand">M1+M2</Badge>
        </div>
        <div className="mt-5 grid md:grid-cols-3 gap-4">
          {PILLARS.map(p => (
            <Link
              key={p.t}
              to={p.to}
              className="block p-5 border border-rule rounded-[var(--radius-card)] hover:border-brand/50 hover:bg-muted/5 transition group"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{p.t}</span>
                <ArrowRight className="w-4 h-4 text-muted group-hover:text-brand group-hover:translate-x-0.5 transition" />
              </div>
              <p className="mt-2 text-sm text-muted leading-relaxed">{p.d}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">路线图</h2>
        <ol className="mt-4 space-y-2 text-sm">
          {[
            ['M0', '脚手架 + 主题切换 + 部署到 hermes:9080/claude/', true],
            ['M1', '基础组件:Button / Input / Card / Modal / Toast / Table', true],
            ['M2', '业务模板:对话页 / 数据看板', true],
            ['M3', 'Storybook + 设计 Tokens 文档站', false],
          ].map(([k, t, done]) => (
            <li key={k as string} className="flex items-baseline gap-3 border-b border-rule/60 pb-2">
              <span className="text-muted font-mono text-xs w-8">{k}</span>
              <span className={done ? 'text-fg' : 'text-muted'}>{t}</span>
              <span className="ml-auto">{done ? <Badge tone="success">已完成</Badge> : <Badge>进行中</Badge>}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
