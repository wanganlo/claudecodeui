import { useMemo, useState } from 'react'
import { RefreshCw, Play, Bot, Briefcase, Wrench, Network, History, Settings, Terminal, Activity } from 'lucide-react'
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Input, Skeleton, Table, Textarea, useToast } from '@/components'
import type { Column } from '@/components/Table'
import { apiGet, apiPost, type Agent, type Job, type Mcp, type RunResult, type Session, type Skill, type Status } from '@/utils/claudeApi'
import { Modal } from '@/components'
import { renderMd } from '@/utils/md'
import { useAsync } from '@/hooks/useAsync'
import { cn } from '@/utils/cn'

const tabs = [
  ['overview', '总览', Activity], ['run', 'CLI 执行', Terminal], ['agents', 'Agents', Bot],
  ['jobs', 'Jobs', Briefcase], ['skills', 'Skills', Wrench], ['mcp', 'MCP', Network],
  ['sessions', 'Sessions', History], ['config', 'Config', Settings],
] as const
type Tab = typeof tabs[number][0]

const tone = (s?: string) => s === 'busy' || s === 'running' || s === 'pending' ? 'signal' : s === 'done' || s === 'idle' || s === 'success' ? 'success' : 'neutral'
const ago = (t?: string | number) => {
  const ms = typeof t === 'number' ? Date.now() - t : t ? Date.now() - new Date(t).getTime() : 0
  if (!ms || Number.isNaN(ms)) return '—'
  const m = Math.floor(ms / 60000); if (m < 1) return '刚刚'; if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60); if (h < 24) return `${h} 小时前`
  return `${Math.floor(h / 24)} 天前`
}

function PanelShell<T>({ title, eyebrow, icon: Icon, resource, children }: {
  title: string; eyebrow: string; icon: any; resource: ReturnType<typeof useAsync<T>>; children: (data: T) => React.ReactNode
}) {
  return (
    <Card>
      <CardHeader title={<span className="flex items-center gap-2"><Icon className="w-4 h-4 text-brand" />{title}</span>} eyebrow={eyebrow}
        action={<Button size="sm" variant="outline" onClick={resource.reload}><RefreshCw className="w-3.5 h-3.5" />刷新</Button>} />
      <CardBody>
        {resource.loading && <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>}
        {resource.error && <EmptyState title="加载失败" desc={resource.error} action={<Button size="sm" onClick={resource.reload}>重试</Button>} />}
        {!resource.loading && !resource.error && resource.data != null && children(resource.data)}
      </CardBody>
    </Card>
  )
}

export default function ClaudeCode() {
  const [tab, setTab] = useState<Tab>('overview')
  const status = useAsync<Status>(() => apiGet('/status'), [], { interval: 8000 })
  const agents = useAsync<Agent[]>(() => apiGet('/agents'), [], { interval: 5000 })
  const jobs = useAsync<Job[]>(() => apiGet('/jobs'), [], { interval: 10000 })
  const skills = useAsync<Skill[]>(() => apiGet('/skills'), [])
  const mcp = useAsync<Mcp[]>(() => apiGet('/mcp'), [])
  const sessions = useAsync<Session[]>(() => apiGet('/sessions'), [])
  const config = useAsync<Record<string, unknown>>(() => apiGet('/config'), [])
  const daemon = useAsync<Record<string, unknown>>(() => apiGet('/daemon'), [])
  const all = [status, agents, jobs, skills, mcp, sessions, config, daemon]
  const reloadAll = () => all.forEach(r => r.reload())

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Claude Code GUI</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Claude Code 控制台</h1>
          <p className="mt-2 text-muted">把 CLI、Agents、Jobs、Skills、MCP、Sessions、配置和状态统一成可视化界面。</p>
        </div>
        <Button variant="outline" onClick={reloadAll}><RefreshCw className="w-4 h-4" />刷新全部</Button>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {tabs.map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)} className={cn('px-3 py-2 text-sm border rounded-[var(--radius-button)] flex items-center gap-1.5', tab === id ? 'bg-brand text-white border-brand' : 'border-rule hover:bg-muted/10')}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {tab === 'overview' && <Overview status={status} agents={agents} jobs={jobs} skills={skills} mcp={mcp} sessions={sessions} daemon={daemon} />}
        {tab === 'run' && <RunCli />}
        {tab === 'agents' && <Agents resource={agents} />}
        {tab === 'jobs' && <Jobs resource={jobs} />}
        {tab === 'skills' && <Skills resource={skills} />}
        {tab === 'mcp' && <McpServers resource={mcp} />}
        {tab === 'sessions' && <Sessions resource={sessions} />}
        {tab === 'config' && <Config resource={config} daemon={daemon} />}
      </div>
    </div>
  )
}

function Overview({ status, agents, jobs, skills, mcp, sessions, daemon }: any) {
  const s = status.data as Status | null
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-px bg-rule border border-rule">
        {[
          ['Agents', s?.agents ?? '—'], ['Jobs', s?.jobs ?? '—'], ['Skills', s?.skills ?? '—'], ['MCP', s?.mcp ?? '—'], ['Sessions', s?.sessions ?? '—'], ['Model', s?.model ?? '—'],
        ].map(([k, v]) => <div key={k} className="bg-bg p-4"><div className="text-[11px] uppercase tracking-[0.18em] text-muted">{k}</div><div className="mt-2 text-xl font-semibold truncate">{v}</div></div>)}
      </div>
      <div className="grid md:grid-cols-3 gap-5">
        <Card><CardHeader title="Agent 状态" eyebrow="live" /><CardBody><MiniList data={agents.data?.slice(0,5)} getTitle={(x:Agent)=>x.name||x.sessionId} getMeta={(x:Agent)=>`${x.kind} · ${x.status||'unknown'} · ${ago(x.startedAt)}`} /></CardBody></Card>
        <Card><CardHeader title="最近 Jobs" eyebrow="daemon" /><CardBody><MiniList data={jobs.data?.slice(0,5)} getTitle={(x:Job)=>x.name||x.intent||x.id} getMeta={(x:Job)=>`${x.state} · ${ago(x.updatedAt||x.createdAt)}`} /></CardBody></Card>
        <Card><CardHeader title="守护进程" eyebrow="daemon.status" /><CardBody><pre className="text-xs bg-muted/10 p-3 rounded overflow-auto max-h-60">{JSON.stringify(daemon.data ?? {}, null, 2)}</pre></CardBody></Card>
      </div>
      <Card><CardHeader title="系统资源索引" eyebrow="inventory" /><CardBody className="grid md:grid-cols-3 gap-4 text-sm text-muted"><div>Skills: {skills.data?.length ?? 0}</div><div>MCP: {mcp.data?.length ?? 0}</div><div>Sessions: {sessions.data?.length ?? 0}</div></CardBody></Card>
    </div>
  )
}
function MiniList({ data, getTitle, getMeta }: any) {
  if (!data?.length) return <EmptyState title="暂无数据" />
  return <div className="space-y-2">{data.map((x:any,i:number)=><div key={i} className="border-b border-rule pb-2 last:border-0"><div className="font-medium truncate">{getTitle(x)}</div><div className="text-xs text-muted truncate">{getMeta(x)}</div></div>)}</div>
}

function RunCli() {
  const [prompt, setPrompt] = useState('只输出 OK')
  const [flags, setFlags] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<RunResult | null>(null)
  const { push } = useToast()
  const run = async () => {
    setRunning(true); setResult(null)
    try { setResult(await apiPost<RunResult>('/run', { prompt, flags, timeout: 120000 })); push('CLI 执行完成', 'success') }
    catch(e:any) { push(String(e?.message || e), 'error') }
    finally { setRunning(false) }
  }
  return <Card><CardHeader title={<span className="flex items-center gap-2"><Terminal className="w-4 h-4 text-brand" />CLI 执行</span>} eyebrow="claude -p --bare" />
    <CardBody className="space-y-4">
      <div><label className="text-xs uppercase tracking-[0.14em] text-muted">Prompt</label><Textarea value={prompt} onChange={e=>setPrompt(e.target.value)} rows={6} className="mt-1.5" /></div>
      <div><label className="text-xs uppercase tracking-[0.14em] text-muted">额外 flags(可空)</label><Input value={flags} onChange={e=>setFlags(e.target.value)} placeholder='例如: --model ark-code-latest --effort low' className="mt-1.5" /></div>
      <Button onClick={run} disabled={running || !prompt.trim()}><Play className="w-4 h-4" />{running?'执行中…':'执行 claude -p'}</Button>
      {result && <div className="grid md:grid-cols-2 gap-4"><pre className="text-xs bg-muted/10 p-3 rounded overflow-auto min-h-48 whitespace-pre-wrap">{result.stdout || '(no stdout)'}</pre><pre className="text-xs bg-muted/10 p-3 rounded overflow-auto min-h-48 whitespace-pre-wrap">{result.stderr || '(no stderr)'}</pre></div>}
    </CardBody></Card>
}

function Agents({ resource }: { resource: ReturnType<typeof useAsync<Agent[]>> }) {
  const cols: Column<Agent & { id: string }>[] = [
    { key:'name', header:'名称', render:r=>r.name||r.sessionId.slice(0,8) }, { key:'kind', header:'类型' },
    { key:'status', header:'状态', render:r=><Badge tone={tone(r.status)}>{r.status||'unknown'}</Badge> }, { key:'cwd', header:'CWD' },
    { key:'startedAt', header:'启动', align:'right', render:r=>ago(r.startedAt) },
  ]
  return <PanelShell title="Agents" eyebrow="claude agents --json" icon={Bot} resource={resource}>{data=><Table columns={cols} rows={data.map((x,i)=>({id:x.sessionId||String(i),...x}))} />}</PanelShell>
}
function JobTimelineDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useAsync<{ events: any[] }>(() => apiGet('/jobs/timeline?id=' + encodeURIComponent(id)), [id])
  return <Modal open={!!id} onClose={onClose} title={`Job ${id} timeline`}><div className="max-h-[70vh] overflow-auto">{t.loading ? <Skeleton className="h-40"/> : <pre className="text-xs whitespace-pre-wrap">{(t.data?.events || []).map((e: any) => JSON.stringify(e)).join('\n')}</pre>}</div></Modal>
}
function Jobs({ resource }: { resource: ReturnType<typeof useAsync<Job[]>> }) {
  const [openId, setOpenId] = useState('')
  const [q, setQ] = useState('')
  const data = useMemo(() => resource.data?.filter(j => (j.name + j.intent + j.detail + j.state).toLowerCase().includes(q.toLowerCase())) ?? [], [resource.data, q])
  const cols: Column<Job>[] = [
    { key: 'name', header: '名称', render: r => <button onClick={() => setOpenId(r.id)} className="text-left"><div className="font-medium text-brand hover:underline">{r.name}</div><div className="text-xs text-muted truncate max-w-[420px]">{r.intent || r.detail}</div></button> },
    { key: 'state', header: '状态', render: r => <Badge tone={tone(r.state)}>{r.state}</Badge> },
    { key: 'tempo', header: '节奏' },
    { key: 'timelineEvents', header: '事件', align: 'right' },
    { key: 'updatedAt', header: '更新', align: 'right', render: r => ago(r.updatedAt || r.createdAt) },
  ]
  return <PanelShell title="Jobs" eyebrow="~/.claude/jobs" icon={Briefcase} resource={resource}>{() => <><Input value={q} onChange={e => setQ(e.target.value)} placeholder="搜索 job…" className="mb-4 max-w-md"/><Table columns={cols} rows={data} />{openId && <JobTimelineDrawer id={openId} onClose={() => setOpenId('')}/>}</>}</PanelShell>
}

function SkillDetailDrawer({ name, onClose }: { name: string; onClose: () => void }) {
  const t = useAsync<{ name: string; files: string[]; content: string }>(() => apiGet('/skills/detail?name=' + encodeURIComponent(name)), [name])
  return <Modal open={!!name} onClose={onClose} title={`Skill · ${name}`}><div className="max-h-[70vh] overflow-auto">{t.loading ? <Skeleton className='h-40'/> : <div className="prose prose-sm" dangerouslySetInnerHTML={{ __html: renderMd(t.data?.content || '') }} />}</div></Modal>
}

function Skills({ resource }: { resource: ReturnType<typeof useAsync<Skill[]>> }) {
  const [openName, setOpenName] = useState('')
  const [q,setQ]=useState(''); const data=useMemo(()=>resource.data?.filter(s=>(s.name+s.description).toLowerCase().includes(q.toLowerCase()))??[],[resource.data,q])
  const cols: Column<Skill & {id:string}>[]=[{key:'name',header:'Skill',render:r=><button onClick={()=>setOpenName(r.name)} className="font-mono text-xs text-brand hover:underline">{r.name}</button>},{key:'description',header:'描述',render:r=><span className="text-muted">{r.description||'—'}</span>},{key:'files',header:'文件',align:'right'},{key:'modified',header:'修改',align:'right',render:r=>ago(r.modified)}]
  return <PanelShell title="Skills" eyebrow="~/.claude/skills" icon={Wrench} resource={resource}>{()=><><Input value={q} onChange={e=>setQ(e.target.value)} placeholder="搜索 skill…" className="mb-4 max-w-md"/><Table columns={cols} rows={data.map(s=>({id:s.name,...s}))} />{openName && <SkillDetailDrawer name={openName} onClose={()=>setOpenName('')}/>}</>}</PanelShell>
}
function McpDetailDrawer({ name, onClose }: { name: string; onClose: () => void }) {
  const t = useAsync<{ output: string }>(() => apiGet('/mcp/get?name=' + encodeURIComponent(name)), [name])
  return <Modal open={!!name} onClose={onClose} title={`MCP · ${name}`}><pre className="text-xs whitespace-pre-wrap max-h-[70vh] overflow-auto">{t.loading ? '...' : (t.data?.output || '')}</pre></Modal>
}
function McpServers({ resource }: { resource: ReturnType<typeof useAsync<Mcp[]>> }) {
  const [openName, setOpenName] = useState('')
  const cols: Column<Mcp & {id:string}>[]=[{key:'name',header:'名称',render:r=><button onClick={()=>setOpenName(r.name)} className="text-brand hover:underline">{r.name}</button>},{key:'status',header:'状态',render:r=><Badge tone={r.status.includes('Pending')?'signal':'success'}>{r.status}</Badge>},{key:'command',header:'命令',render:r=><code className="text-xs text-muted">{r.command}</code>}]
  return <PanelShell title="MCP Servers" eyebrow="claude mcp list" icon={Network} resource={resource}>{data=><><Table columns={cols} rows={data.map(x=>({id:x.name,...x}))}/>{openName && <McpDetailDrawer name={openName} onClose={()=>setOpenName('')}/>}</>}</PanelShell>
}
function SessionDetailDrawer({ id, project, onClose }: { id: string; project: string; onClose: () => void }) {
  const t = useAsync<{ events: any[] }>(() => apiGet('/sessions/detail?id=' + encodeURIComponent(id) + '&project=' + encodeURIComponent(project)), [id, project])
  return <Modal open={!!id} onClose={onClose} title={`Session · ${id.slice(0,8)}…`}><div className="max-h-[70vh] overflow-auto space-y-2 text-xs">{t.loading ? <Skeleton className='h-40'/> : (t.data?.events || []).map((e: any, i: number) => <div key={i} className="border-b border-rule pb-2"><div className="font-mono text-[10px] text-muted">{e.ts || ''} · {e.role || e.event}</div>{e.text && <pre className="mt-1 whitespace-pre-wrap">{e.text}</pre>}</div>)}</div></Modal>
}
function Sessions({ resource }: { resource: ReturnType<typeof useAsync<Session[]>> }) {
  const [open, setOpen] = useState<{ id: string; project: string } | null>(null)
  const cols: Column<Session>[]=[{key:'sessionId',header:'Session',render:r=><button onClick={()=>setOpen({id:r.sessionId,project:r.project})} className="text-brand hover:underline"><code className="text-xs">{r.sessionId.slice(0,8)}…</code></button>},{key:'project',header:'Project'},{key:'size',header:'大小',align:'right',render:r=>`${Math.round(r.size/1024)} KB`},{key:'modified',header:'修改',align:'right',render:r=>ago(r.modified)}]
  return <PanelShell title="Sessions" eyebrow="~/.claude/projects" icon={History} resource={resource}>{data=><><Table columns={cols} rows={data.map(x=>({id:x.sessionId,...x}))}/>{open && <SessionDetailDrawer id={open.id} project={open.project} onClose={()=>setOpen(null)}/>}</>}</PanelShell>
}
function Config({ resource, daemon }: { resource: ReturnType<typeof useAsync<Record<string, unknown>>>; daemon: ReturnType<typeof useAsync<Record<string, unknown>>> }) {
  return <div className="grid md:grid-cols-2 gap-5"><PanelShell title="Settings" eyebrow="~/.claude/settings.json" icon={Settings} resource={resource}>{data=><pre className="text-xs bg-muted/10 p-3 rounded overflow-auto max-h-[70vh]">{JSON.stringify(data,null,2)}</pre>}</PanelShell><PanelShell title="Daemon" eyebrow="daemon.status.json" icon={Activity} resource={daemon}>{data=><pre className="text-xs bg-muted/10 p-3 rounded overflow-auto max-h-[70vh]">{JSON.stringify(data,null,2)}</pre>}</PanelShell></div>
}
