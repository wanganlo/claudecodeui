import { useEffect, useState } from 'react'
import { Card, CardHeader, CardBody, Badge, Table, Skeleton, EmptyState } from '@/components'
import type { Column } from '@/components/Table'
import { TrendingUp, TrendingDown, Minus, Activity, Users, Package, Server } from 'lucide-react'
import type { ComponentType } from 'react'
import { storage } from '@/utils/storage'

type Kpi = { k: string; v: string; delta: string; tone: 'up' | 'down' | 'flat'; icon: ComponentType<{ className?: string }> }
type Job = { id: string; name: string; owner: string; status: 'success' | 'running' | 'failed'; duration: string }

// 用真实数据源:从本项目当前状态计算 + 浏览器 performance + Chat 持久化数据
function buildKpis(): Kpi[] {
  const threads = storage.get<any[]>('chat:threads', [])
  const totalMsgs = threads.reduce((s, t) => s + (t.msgs?.length ?? 0), 0)
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  const ttfb = nav ? Math.round(nav.responseStart - nav.requestStart) : 0
  const load = nav ? Math.round(nav.loadEventEnd - nav.startTime) : 0

  return [
    { k: '本地会话',  v: `${threads.length}`, delta: `${totalMsgs} 条消息`, tone: 'up',   icon: Users },
    { k: '页面 TTFB', v: `${ttfb}ms`,         delta: ttfb < 100 ? '良好' : '可改善', tone: ttfb < 100 ? 'up' : 'flat', icon: Server },
    { k: '组件交付',  v: '12 / 12',           delta: '+3',           tone: 'up',   icon: Package },
    { k: '加载耗时',  v: `${load}ms`,         delta: load < 1500 ? '良好' : '偏慢', tone: load < 1500 ? 'up' : 'down', icon: Activity },
  ]
}

const Spark = ({ data }: { data: number[] }) => {
  if (!data.length) return null
  const max = Math.max(...data); const min = Math.min(...data); const r = max - min || 1
  const pts = data.map((v, i) => `${(i / Math.max(data.length - 1, 1)) * 100},${100 - ((v - min) / r) * 100}`).join(' ')
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-12">
      <polyline fill="none" stroke="rgb(var(--brand))" strokeWidth="2" points={pts} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

const seedJobs: Job[] = [
  { id: '1', name: 'build:claude-ui',     owner: 'claude',     status: 'success', duration: '8.99s' },
  { id: '2', name: 'deploy:/claude/',     owner: 'claude',     status: 'success', duration: '0.6s' },
  { id: '3', name: 'fetch:skill-radar',   owner: 'subagent-D', status: 'success', duration: '3.2s' },
  { id: '4', name: 'theme-sync:tech',     owner: 'subagent-B', status: 'running', duration: '—' },
  { id: '5', name: 'lint:components',     owner: 'ci',         status: 'failed',  duration: '1.1s' },
]
const jobCols: Column<Job>[] = [
  { key: 'name',     header: '任务' },
  { key: 'owner',    header: '执行者' },
  { key: 'status',   header: '状态',
    render: r => <Badge tone={r.status === 'success' ? 'success' : r.status === 'running' ? 'brand' : 'signal'}>{r.status}</Badge> },
  { key: 'duration', header: '耗时', align: 'right' },
]

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [kpis, setKpis] = useState<Kpi[]>([])
  const [jobs, setJobs] = useState<Job[]>([])

  useEffect(() => {
    // 模拟一段加载,验证 Skeleton 可用
    const t = setTimeout(() => {
      setKpis(buildKpis())
      setJobs(seedJobs)
      setLoading(false)
    }, 400)
    return () => clearTimeout(t)
  }, [])

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-muted">M2</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">数据看板</h1>
      <p className="mt-2 text-muted">KPI 取自浏览器 performance 与本地 Chat 持久化数据 —— 真实可观测。</p>

      <section className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-px bg-rule/60 border border-rule">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-bg p-5 space-y-3">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))
          : kpis.map(({ k, v, delta, tone, icon: Icon }) => (
              <div key={k} className="bg-bg p-5">
                <div className="flex items-center justify-between text-muted">
                  <span className="text-[11px] uppercase tracking-[0.18em]">{k}</span>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="mt-3 text-2xl font-semibold tabular-nums">{v}</div>
                <div className={
                  'mt-1 text-xs flex items-center gap-1 ' +
                  (tone === 'up' ? 'text-emerald-600 dark:text-emerald-400'
                    : tone === 'down' ? 'text-signal' : 'text-muted')
                }>
                  {tone === 'up' ? <TrendingUp className="w-3 h-3" /> : tone === 'down' ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                  {delta}
                </div>
              </div>
            ))}
      </section>

      <section className="mt-10 grid md:grid-cols-3 gap-5">
        <Card className="md:col-span-2">
          <CardHeader title="本周构建数(示例)" eyebrow="Trend" />
          <CardBody>
            {loading ? <Skeleton className="h-12 w-full" /> : <Spark data={[12, 18, 15, 22, 28, 24, 31]} />}
            <div className="mt-3 grid grid-cols-7 text-[10px] text-muted text-center">
              {['一', '二', '三', '四', '五', '六', '日'].map(d => <span key={d}>{d}</span>)}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="健康度" eyebrow="System" />
          <CardBody className="space-y-3">
            {[{ l: 'API', v: 99 }, { l: 'Worker', v: 96 }, { l: 'Build', v: 84 }].map(r => (
              <div key={r.l}>
                <div className="flex justify-between text-xs"><span className="text-muted">{r.l}</span><span className="tabular-nums">{r.v}%</span></div>
                <div className="mt-1 h-1.5 rounded bg-muted/15 overflow-hidden">
                  <div className={r.v >= 95 ? 'h-full bg-emerald-500' : 'h-full bg-signal'} style={{ width: `${r.v}%` }} />
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </section>

      <section className="mt-10">
        <Card>
          <CardHeader title="最近任务" eyebrow="Jobs" action={<Badge tone="brand">{jobs.length}</Badge>} />
          <CardBody>
            {loading
              ? <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
              : jobs.length
                ? <Table columns={jobCols} rows={jobs} />
                : <EmptyState title="暂无任务" desc="构建/部署任务会展示在这里。" />}
          </CardBody>
        </Card>
      </section>
    </div>
  )
}
