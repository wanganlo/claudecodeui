import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button, Card, CardBody, CardHeader, Skeleton } from '@/components'
import { apiGet } from '@/utils/claudeApi'
import { useAsync } from '@/hooks/useAsync'
import { cn } from '@/utils/cn'

const SOURCES = [['service','后端服务 systemd'],['daemon','Claude daemon.log'],['nginx','/claude/ access.log']] as const
type Src = typeof SOURCES[number][0]

export default function Logs() {
  const [src, setSrc] = useState<Src>('service')
  const [n, setN] = useState(200)
  const t = useAsync<{ source: string; lines: string[] }>(() => apiGet(`/logs?source=${src}&n=${n}`), [src, n], { interval: 8000 })
  return <div>
    <p className="text-xs uppercase tracking-[0.18em] text-muted">Logs</p>
    <h1 className="mt-2 text-3xl font-bold tracking-tight">日志</h1>
    <p className="mt-2 text-muted">实时拉取后端服务、Claude daemon 与 nginx 访问日志(8s 自动刷新)。</p>

    <div className="mt-6 flex gap-2 flex-wrap">
      {SOURCES.map(([id, label]) => (
        <button key={id} onClick={() => setSrc(id)} className={cn('px-3 py-2 text-sm border rounded', src===id?'bg-brand text-white border-brand':'border-rule hover:bg-muted/10')}>{label}</button>
      ))}
      <select value={n} onChange={e=>setN(+e.target.value)} className="text-sm border border-rule rounded px-2 py-1 bg-bg">
        {[100,200,500,1000].map(v=><option key={v} value={v}>{v} 行</option>)}
      </select>
      <Button size="sm" variant="outline" onClick={()=>t.reload()}><RefreshCw className="w-3.5 h-3.5"/>刷新</Button>
    </div>

    <Card className="mt-6">
      <CardHeader title={`source: ${src}`} eyebrow="logs" />
      <CardBody>
        {t.loading && <Skeleton className="h-60"/>}
        {t.data && <pre className="text-[11px] bg-muted/10 p-3 rounded font-mono whitespace-pre-wrap overflow-auto max-h-[70vh]">{t.data.lines.join('\n')}</pre>}
      </CardBody>
    </Card>
  </div>
}
