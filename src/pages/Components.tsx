import { useState } from 'react'
import {
  Button, Input, Textarea, Card, CardHeader, CardBody, Badge,
  Modal, Table, useToast, Skeleton, EmptyState,
} from '@/components'
import type { Column } from '@/components/Table'
import { storage } from '@/utils/storage'

type Row = { id: number; name: string; status: 'active' | 'pending' | 'archived'; updated: string }
const data: Row[] = [
  { id: 1, name: 'Button', status: 'active',   updated: '2m ago' },
  { id: 2, name: 'Input',  status: 'active',   updated: '5m ago' },
  { id: 3, name: 'Modal',  status: 'pending',  updated: '1h ago' },
  { id: 4, name: 'Toast',  status: 'active',   updated: '12m ago' },
  { id: 5, name: 'Table',  status: 'archived', updated: 'yesterday' },
]
const cols: Column<Row>[] = [
  { key: 'name', header: '组件' },
  { key: 'status', header: '状态',
    render: r => (
      <Badge tone={r.status === 'active' ? 'success' : r.status === 'pending' ? 'signal' : 'neutral'}>{r.status}</Badge>
    ),
  },
  { key: 'updated', header: '更新时间', align: 'right' },
]

export default function Components() {
  const [open, setOpen] = useState(false)
  const [showSkeleton, setShowSkeleton] = useState(false)
  const [showEmpty, setShowEmpty] = useState(false)
  const { push } = useToast()

  const clearLocal = () => {
    storage.del('chat:threads'); storage.del('chat:active')
    push('已清空本地会话,刷新生效', 'success')
  }

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-muted">M1</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">基础组件</h1>
      <p className="mt-2 text-muted">12 个常用组件,token 化,主题感知,无障碍可用。</p>

      <section className="mt-10 space-y-10">
        <Card>
          <CardHeader title="Button" eyebrow="Action" />
          <CardBody className="flex flex-wrap gap-3">
            <Button>Primary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
            <Button disabled>Disabled</Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Input / Textarea" eyebrow="Form" />
          <CardBody className="grid md:grid-cols-2 gap-4 max-w-[760px]">
            <div>
              <label htmlFor="demo-name" className="text-xs uppercase tracking-[0.14em] text-muted">名称</label>
              <Input id="demo-name" placeholder="输入一个名字" className="mt-1.5" />
            </div>
            <div>
              <label htmlFor="demo-email" className="text-xs uppercase tracking-[0.14em] text-muted">邮箱</label>
              <Input id="demo-email" type="email" placeholder="you@example.com" className="mt-1.5" />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="demo-note" className="text-xs uppercase tracking-[0.14em] text-muted">备注</label>
              <Textarea id="demo-note" rows={4} placeholder="可填可不填" className="mt-1.5" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Modal & Toast" eyebrow="Overlay" />
          <CardBody className="flex flex-wrap gap-3">
            <Button onClick={() => setOpen(true)}>打开 Modal</Button>
            <Button variant="outline" onClick={() => push('已保存', 'success')}>提示成功</Button>
            <Button variant="outline" onClick={() => push('网络异常,请稍后再试', 'error')}>提示错误</Button>
            <Button variant="ghost" onClick={() => push('这是一条普通通知')}>普通通知</Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Table"
            eyebrow="Data"
            action={<Badge tone="brand">{data.length} rows</Badge>}
          />
          <CardBody>
            <Table columns={cols} rows={data} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Skeleton / EmptyState" eyebrow="State" />
          <CardBody>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setShowSkeleton(s => !s)}>
                {showSkeleton ? '隐藏 Skeleton' : '显示 Skeleton'}
              </Button>
              <Button variant="outline" onClick={() => setShowEmpty(s => !s)}>
                {showEmpty ? '隐藏 EmptyState' : '显示 EmptyState'}
              </Button>
            </div>
            {showSkeleton && (
              <div className="mt-4 space-y-2">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            )}
            {showEmpty && (
              <div className="mt-4">
                <EmptyState title="还没有内容" desc="把第一条数据放进来,这里就活起来了。" action={<Button size="sm">添加</Button>} />
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="本地数据" eyebrow="Storage" />
          <CardBody className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted">Chat 页的会话存放在 localStorage,这里可以一键清空。</span>
            <Button variant="danger" size="sm" onClick={clearLocal}>清空本地会话</Button>
          </CardBody>
        </Card>
      </section>

      <Modal open={open} onClose={() => setOpen(false)} title="确认操作">
        <p className="text-sm text-muted">这是一个示例 Modal,按 Esc 或点击外部即可关闭。</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
          <Button onClick={() => { setOpen(false); push('已确认', 'success') }}>确认</Button>
        </div>
      </Modal>
    </div>
  )
}
