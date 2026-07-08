import { useMemo, useState } from 'react'
import { BookOpen, Search } from 'lucide-react'
import {
  Badge, Button, Card, CardBody, CardHeader, CodeBlock, EmptyState,
  Input, Modal, Skeleton, Table, Textarea, useToast,
} from '@/components'
import type { Column } from '@/components/Table'
import { cn } from '@/utils/cn'

type PropRow = { id: string; prop: string; type: string; def: string; desc: string }
type Variant = { id: string; label: string; demo: () => JSX.Element; code: string }
type Doc = {
  id: string
  name: string
  category: string
  summary: string
  imports: string
  props: PropRow[]
  variants: Variant[]
}

const propsCols: Column<PropRow>[] = [
  { key: 'prop', header: 'Prop', render: r => <code className="text-[12.5px]">{r.prop}</code> },
  { key: 'type', header: 'Type', render: r => <code className="text-[12.5px] text-brand">{r.type}</code> },
  { key: 'def', header: '默认' },
  { key: 'desc', header: '说明' },
]

// ---------- 文档数据 ----------
const DOCS: Doc[] = [
  {
    id: 'button',
    name: 'Button',
    category: 'Action',
    summary: '动作按钮,支持 4 种样式与 3 种尺寸,包含 focus ring 与 disabled 态。',
    imports: `import { Button } from '@/components'`,
    props: [
      { id: '1', prop: 'variant', type: `'primary' | 'outline' | 'ghost' | 'danger'`, def: 'primary', desc: '视觉样式' },
      { id: '2', prop: 'size', type: `'sm' | 'md' | 'lg'`, def: 'md', desc: '尺寸' },
      { id: '3', prop: 'disabled', type: 'boolean', def: 'false', desc: '禁用态' },
    ],
    variants: [
      {
        id: 'variants', label: '样式',
        demo: () => (
          <div className="flex flex-wrap gap-2">
            <Button>Primary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
          </div>
        ),
        code: `<Button>Primary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="danger">Danger</Button>`,
      },
      {
        id: 'sizes', label: '尺寸',
        demo: () => (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </div>
        ),
        code: `<Button size="sm">Small</Button>
<Button size="md">Medium</Button>
<Button size="lg">Large</Button>`,
      },
      {
        id: 'states', label: '状态',
        demo: () => (
          <div className="flex flex-wrap gap-2">
            <Button disabled>Disabled</Button>
            <Button variant="outline" disabled>Outline Disabled</Button>
          </div>
        ),
        code: `<Button disabled>Disabled</Button>`,
      },
    ],
  },
  {
    id: 'input',
    name: 'Input',
    category: 'Form',
    summary: '基础输入框,token 化高度与圆角,支持 focus ring 与 disabled。',
    imports: `import { Input } from '@/components'`,
    props: [
      { id: '1', prop: 'type', type: 'string', def: 'text', desc: '原生 input type' },
      { id: '2', prop: 'placeholder', type: 'string', def: '—', desc: '占位文字' },
      { id: '3', prop: 'disabled', type: 'boolean', def: 'false', desc: '禁用态' },
    ],
    variants: [
      {
        id: 'basic', label: '基础',
        demo: () => (
          <div className="grid sm:grid-cols-2 gap-3 max-w-md">
            <Input placeholder="请输入名称" />
            <Input type="email" placeholder="you@example.com" />
            <Input disabled placeholder="禁用" />
            <Input defaultValue="预设值" />
          </div>
        ),
        code: `<Input placeholder="请输入名称" />
<Input type="email" placeholder="you@example.com" />
<Input disabled placeholder="禁用" />`,
      },
    ],
  },
  {
    id: 'textarea',
    name: 'Textarea',
    category: 'Form',
    summary: '多行输入,默认可纵向调整大小。',
    imports: `import { Textarea } from '@/components'`,
    props: [
      { id: '1', prop: 'rows', type: 'number', def: '3', desc: '初始行数' },
    ],
    variants: [
      {
        id: 'basic', label: '基础',
        demo: () => <Textarea rows={4} placeholder="可填可不填" className="max-w-md" />,
        code: `<Textarea rows={4} placeholder="可填可不填" />`,
      },
    ],
  },
  {
    id: 'card',
    name: 'Card',
    category: 'Container',
    summary: '内容卡片三段式:Header(eyebrow + title + action) / Body / 自定义 Footer。',
    imports: `import { Card, CardHeader, CardBody } from '@/components'`,
    props: [
      { id: '1', prop: 'title', type: 'ReactNode', def: '—', desc: '卡片标题' },
      { id: '2', prop: 'eyebrow', type: 'ReactNode', def: '—', desc: '小标 / 分类' },
      { id: '3', prop: 'action', type: 'ReactNode', def: '—', desc: '右上角操作区' },
    ],
    variants: [
      {
        id: 'basic', label: '基础',
        demo: () => (
          <Card className="max-w-md">
            <CardHeader title="部署状态" eyebrow="Overview" action={<Badge tone="success">running</Badge>} />
            <CardBody className="text-sm text-muted">
              一切正常,最近一次健康检查在 2 分钟前。
            </CardBody>
          </Card>
        ),
        code: `<Card>
  <CardHeader title="部署状态" eyebrow="Overview"
    action={<Badge tone="success">running</Badge>} />
  <CardBody>一切正常…</CardBody>
</Card>`,
      },
    ],
  },
  {
    id: 'badge',
    name: 'Badge',
    category: 'Display',
    summary: '4 种语义色:neutral / brand / signal / success。',
    imports: `import { Badge } from '@/components'`,
    props: [
      { id: '1', prop: 'tone', type: `'neutral' | 'brand' | 'signal' | 'success'`, def: 'neutral', desc: '语义色' },
    ],
    variants: [
      {
        id: 'tones', label: '语义色',
        demo: () => (
          <div className="flex flex-wrap gap-2">
            <Badge>neutral</Badge>
            <Badge tone="brand">brand</Badge>
            <Badge tone="signal">signal</Badge>
            <Badge tone="success">success</Badge>
          </div>
        ),
        code: `<Badge>neutral</Badge>
<Badge tone="brand">brand</Badge>
<Badge tone="signal">signal</Badge>
<Badge tone="success">success</Badge>`,
      },
    ],
  },
  {
    id: 'modal',
    name: 'Modal',
    category: 'Overlay',
    summary: '阻塞式对话框,Esc / 点击遮罩关闭,带 a11y role/aria。',
    imports: `import { Modal } from '@/components'`,
    props: [
      { id: '1', prop: 'open', type: 'boolean', def: 'false', desc: '是否打开' },
      { id: '2', prop: 'onClose', type: '() => void', def: '—', desc: '关闭回调' },
      { id: '3', prop: 'title', type: 'ReactNode', def: '—', desc: '标题' },
    ],
    variants: [
      {
        id: 'basic', label: '示例', demo: () => <ModalDemo />,
        code: `const [open, setOpen] = useState(false)
<Button onClick={() => setOpen(true)}>打开</Button>
<Modal open={open} onClose={() => setOpen(false)} title="标题">
  内容
</Modal>`,
      },
    ],
  },
  {
    id: 'toast',
    name: 'Toast',
    category: 'Overlay',
    summary: '通过 ToastProvider 提供全局上下文,在任意组件里 useToast().push(msg, tone) 即可提示。',
    imports: `import { useToast } from '@/components'`,
    props: [
      { id: '1', prop: 'msg', type: 'string', def: '—', desc: '消息内容' },
      { id: '2', prop: 'tone', type: `'info' | 'success' | 'error'`, def: 'info', desc: '语义色' },
    ],
    variants: [
      {
        id: 'basic', label: '示例', demo: () => <ToastDemo />,
        code: `const { push } = useToast()
push('已保存', 'success')
push('网络异常', 'error')
push('提示信息')`,
      },
    ],
  },
  {
    id: 'table',
    name: 'Table',
    category: 'Data',
    summary: '极简数据表,接受 columns + rows,支持自定义 render 与对齐。',
    imports: `import { Table } from '@/components'\nimport type { Column } from '@/components/Table'`,
    props: [
      { id: '1', prop: 'columns', type: 'Column<T>[]', def: '—', desc: '列定义' },
      { id: '2', prop: 'rows', type: 'T[]', def: '—', desc: '数据行,需含 id' },
    ],
    variants: [
      {
        id: 'basic', label: '基础', demo: () => <TableDemo />,
        code: `const cols: Column<Row>[] = [
  { key: 'name', header: '组件' },
  { key: 'updated', header: '更新', align: 'right' },
]
<Table columns={cols} rows={data} />`,
      },
    ],
  },
  {
    id: 'skeleton',
    name: 'Skeleton',
    category: 'State',
    summary: '占位骨架屏,通过 className 控制宽高与圆角。',
    imports: `import { Skeleton } from '@/components'`,
    props: [
      { id: '1', prop: 'className', type: 'string', def: '—', desc: '尺寸样式' },
    ],
    variants: [
      {
        id: 'basic', label: '基础',
        demo: () => (
          <div className="space-y-2 max-w-sm">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ),
        code: `<Skeleton className="h-5 w-1/3" />
<Skeleton className="h-3 w-2/3" />`,
      },
    ],
  },
  {
    id: 'empty',
    name: 'EmptyState',
    category: 'State',
    summary: '无数据占位,标题/描述/动作三段。',
    imports: `import { EmptyState } from '@/components'`,
    props: [
      { id: '1', prop: 'title', type: 'ReactNode', def: '暂无数据', desc: '标题' },
      { id: '2', prop: 'desc', type: 'ReactNode', def: '—', desc: '描述' },
      { id: '3', prop: 'action', type: 'ReactNode', def: '—', desc: '操作按钮' },
    ],
    variants: [
      {
        id: 'basic', label: '基础',
        demo: () => (
          <EmptyState title="还没有内容" desc="把第一条数据放进来,这里就活起来了。" action={<Button size="sm">添加</Button>} />
        ),
        code: `<EmptyState title="还没有内容" desc="…"
  action={<Button size="sm">添加</Button>} />`,
      },
    ],
  },
  {
    id: 'codeblock',
    name: 'CodeBlock',
    category: 'Display',
    summary: '展示代码片段,自带语言标签与一键复制。',
    imports: `import { CodeBlock } from '@/components'`,
    props: [
      { id: '1', prop: 'code', type: 'string', def: '—', desc: '代码字符串' },
      { id: '2', prop: 'lang', type: 'string', def: 'tsx', desc: '语言标签' },
    ],
    variants: [
      {
        id: 'basic', label: '基础',
        demo: () => <CodeBlock code={`const sum = (a: number, b: number) => a + b\nconsole.log(sum(2, 3))`} lang="ts" />,
        code: `<CodeBlock lang="ts" code={\`const sum = (a, b) => a + b\`} />`,
      },
    ],
  },
]

// ---------- 内嵌 demo ----------
function ModalDemo() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>打开 Modal</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="确认操作">
        <p className="text-sm text-muted">这是一个示例 Modal,按 Esc 或点击外部即可关闭。</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
          <Button onClick={() => setOpen(false)}>确认</Button>
        </div>
      </Modal>
    </>
  )
}
function ToastDemo() {
  const { push } = useToast()
  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => push('已保存', 'success')}>成功</Button>
      <Button variant="outline" onClick={() => push('网络异常,请稍后再试', 'error')}>错误</Button>
      <Button variant="ghost" onClick={() => push('一条普通通知')}>普通</Button>
    </div>
  )
}
function TableDemo() {
  type R = { id: number; name: string; updated: string }
  const rows: R[] = [
    { id: 1, name: 'Button', updated: '2m ago' },
    { id: 2, name: 'Input', updated: '5m ago' },
    { id: 3, name: 'Modal', updated: '1h ago' },
  ]
  const cols: Column<R>[] = [
    { key: 'name', header: '组件' },
    { key: 'updated', header: '更新', align: 'right' },
  ]
  return <Table columns={cols} rows={rows} />
}

// ---------- 页面 ----------
export default function Docs() {
  const [active, setActive] = useState<string>(DOCS[0].id)
  const [tab, setTab] = useState<Record<string, 'demo' | 'code'>>({})
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase()
    if (!k) return DOCS
    return DOCS.filter(d =>
      d.name.toLowerCase().includes(k) || d.category.toLowerCase().includes(k) || d.summary.toLowerCase().includes(k)
    )
  }, [q])
  const grouped = useMemo(() => {
    const g: Record<string, Doc[]> = {}
    filtered.forEach(d => { (g[d.category] ||= []).push(d) })
    return g
  }, [filtered])

  const doc = DOCS.find(d => d.id === active) ?? DOCS[0]
  const t = tab[doc.id] ?? 'demo'

  return (
    <div className="grid grid-cols-[240px_minmax(0,1fr)] gap-6">
      {/* 左侧导航 */}
      <aside className="border-r border-rule pr-4 sticky top-0 self-start max-h-[calc(100vh-90px)] overflow-y-auto">
        <p className="text-xs uppercase tracking-[0.18em] text-muted">M3</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight flex items-center gap-1.5"><BookOpen className="w-4 h-4 text-brand" />文档</h2>
        <div className="relative mt-4">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="搜索组件…" className="pl-7 h-8 text-xs" />
        </div>
        <nav className="mt-4 space-y-4">
          {Object.entries(grouped).map(([cat, list]) => (
            <div key={cat}>
              <div className="px-2 text-[10.5px] uppercase tracking-[0.18em] text-muted">{cat}</div>
              <div className="mt-1">
                {list.map(d => (
                  <button
                    key={d.id}
                    onClick={() => setActive(d.id)}
                    className={cn(
                      'w-full text-left px-2.5 py-1.5 text-sm rounded-[var(--radius-button)] transition',
                      active === d.id ? 'bg-brand/10 text-brand' : 'text-muted hover:text-fg hover:bg-muted/10',
                    )}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {!filtered.length && <div className="px-2 py-4 text-xs text-muted">没匹配的组件</div>}
        </nav>
      </aside>

      {/* 右侧详情 */}
      <main className="min-w-0">
        <p className="text-xs uppercase tracking-[0.18em] text-muted">{doc.category}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{doc.name}</h1>
        <p className="mt-2 text-muted">{doc.summary}</p>

        <section className="mt-6">
          <CodeBlock code={doc.imports} lang="ts" />
        </section>

        <section className="mt-8 space-y-8">
          {doc.variants.map(v => (
            <Card key={v.id}>
              <CardHeader
                title={v.label}
                eyebrow="Example"
                action={
                  <div className="inline-flex border border-rule rounded-[var(--radius-button)] overflow-hidden text-xs">
                    {(['demo', 'code'] as const).map(k => (
                      <button
                        key={k}
                        onClick={() => setTab(s => ({ ...s, [doc.id]: k }))}
                        className={cn('px-2.5 py-1', t === k ? 'bg-brand text-white' : 'hover:bg-muted/10')}
                      >
                        {k === 'demo' ? 'Demo' : 'Code'}
                      </button>
                    ))}
                  </div>
                }
              />
              <CardBody>
                {t === 'demo' ? (
                  <div className="rounded-[var(--radius-card)] border border-dashed border-rule p-6 bg-muted/[0.03]">
                    {v.demo()}
                  </div>
                ) : (
                  <CodeBlock code={v.code} lang="tsx" />
                )}
              </CardBody>
            </Card>
          ))}
        </section>

        <section className="mt-10">
          <Card>
            <CardHeader title="Props" eyebrow="API" action={<Badge>{doc.props.length}</Badge>} />
            <CardBody>
              <Table columns={propsCols} rows={doc.props} />
            </CardBody>
          </Card>
        </section>
      </main>
    </div>
  )
}
