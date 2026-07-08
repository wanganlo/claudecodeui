import { useEffect, useRef, useState } from 'react'
import { ChevronRight, Folder, FileText, FilePlus, FolderPlus, GitBranch, Play, RefreshCw, Save, Square, Trash2, X } from 'lucide-react'
import { Badge, Button, EmptyState, Input, Skeleton, Textarea, useToast } from '@/components'
import { apiGet, apiPost, streamCli, type FsList, type FsRead, type GitStatus, type ShellResult } from '@/utils/claudeApi'
import { useAsync } from '@/hooks/useAsync'
import { useCliPrefs } from '@/hooks/useCliPrefs'
import { cn } from '@/utils/cn'

const ROOT = '/home/admin/files/projects/claude-ui'
type Mode = 'cli' | 'shell' | 'git'
type OpenFile = { path: string; content: string; dirty: boolean; original: string }

export default function WorkBench() {
  const [dir, setDir] = useState(ROOT)
  const [tabs, setTabs] = useState<OpenFile[]>([])
  const [active, setActive] = useState<string>('')
  const [mode, setMode] = useState<Mode>('cli')
  const list = useAsync<FsList>(() => apiGet('/fs/list?dir=' + encodeURIComponent(dir)), [dir])
  const { push } = useToast()
  const current = tabs.find(t => t.path === active)

  const openFile = async (p: string, type: string) => {
    if (type === 'dir') { setDir(p); return }
    if (tabs.some(t => t.path === p)) { setActive(p); return }
    try {
      const r = await apiGet<FsRead>('/fs/read?file=' + encodeURIComponent(p))
      setTabs(ts => [...ts, { path: r.file, content: r.content, dirty: false, original: r.content }])
      setActive(r.file)
    } catch (e: any) { push(String(e?.message || e), 'error') }
  }
  const closeTab = (p: string) => {
    const t = tabs.find(x => x.path === p)
    if (t?.dirty && !confirm('文件未保存,确定关闭?')) return
    setTabs(ts => ts.filter(x => x.path !== p))
    if (active === p) setActive(tabs[tabs.length - 2]?.path || '')
  }
  const setContent = (val: string) => setTabs(ts => ts.map(t => t.path === active ? { ...t, content: val, dirty: val !== t.original } : t))
  const save = async () => {
    if (!current) return
    try {
      await apiPost('/fs/write', { file: current.path, content: current.content })
      setTabs(ts => ts.map(t => t.path === current.path ? { ...t, dirty: false, original: t.content } : t))
      push('已保存', 'success')
    } catch (e: any) { push(String(e?.message || e), 'error') }
  }
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 's' && current) { e.preventDefault(); save() } }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [current])

  const newFile = async () => {
    const name = prompt('新文件名(在当前目录):'); if (!name) return
    const target = `${dir}/${name}`
    await apiPost('/fs/write', { file: target, content: '' })
    list.reload(); push('已创建', 'success')
  }
  const newDir = async () => {
    const name = prompt('新文件夹名:'); if (!name) return
    await apiPost('/fs/mkdir', { dir: `${dir}/${name}` })
    list.reload(); push('已创建', 'success')
  }
  const removeEntry = async (p: string) => {
    if (!confirm(`确定删除 ${p}?`)) return
    await apiPost('/fs/delete', { path: p })
    list.reload(); setTabs(ts => ts.filter(t => !t.path.startsWith(p))); push('已删除', 'success')
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Codex-like Workbench</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">工作台</h1>
        </div>
        <div className="flex gap-2 text-xs text-muted"><span>⌘/Ctrl+S 保存 · 文件操作沙箱在 $HOME</span></div>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_minmax(0,1fr)] gap-px bg-rule border border-rule rounded-[var(--radius-card)] overflow-hidden h-[calc(100vh-220px)] min-h-[560px]">
        {/* File tree */}
        <div className="bg-bg flex flex-col min-h-0">
          <div className="px-3 py-2 border-b border-rule flex items-center gap-2 text-xs">
            <button className="text-muted hover:text-brand" onClick={() => list.data && setDir(list.data.parent)} title={list.data?.parent}>..</button>
            <span className="truncate flex-1" title={dir}>{dir.replace('/home/admin', '~')}</span>
            <button onClick={newFile} title="新建文件" className="p-1 hover:bg-muted/10 rounded"><FilePlus className="w-3 h-3"/></button>
            <button onClick={newDir} title="新建目录" className="p-1 hover:bg-muted/10 rounded"><FolderPlus className="w-3 h-3"/></button>
            <button onClick={() => list.reload()} className="p-1 hover:bg-muted/10 rounded"><RefreshCw className="w-3 h-3" /></button>
          </div>
          <div className="flex-1 overflow-auto p-1">
            {list.loading && <div className="p-3 space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-5" />)}</div>}
            {list.data?.entries.map(e => (
              <div key={e.path} className={cn('group flex items-center gap-2 px-2 py-1 rounded text-sm', active===e.path && 'bg-brand/10 text-brand', 'hover:bg-muted/10')}>
                <button onClick={() => openFile(e.path, e.type)} className="flex-1 flex items-center gap-2 min-w-0 text-left">
                  {e.type === 'dir' ? <Folder className="w-3.5 h-3.5 text-brand"/> : <FileText className="w-3.5 h-3.5 text-muted"/>}
                  <span className="truncate">{e.name}</span>
                  {e.type === 'dir' && <ChevronRight className="w-3 h-3 text-muted"/>}
                </button>
                <button onClick={() => removeEntry(e.path)} className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-signal/10 hover:text-signal rounded" title="删除"><Trash2 className="w-3 h-3"/></button>
              </div>
            ))}
          </div>
        </div>

        {/* Editor */}
        <div className="bg-bg flex flex-col min-w-0">
          {/* Tab strip */}
          <div className="border-b border-rule flex items-center overflow-auto">
            {tabs.map(t => (
              <div key={t.path} className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs border-r border-rule cursor-pointer', active===t.path?'bg-bg text-fg':'text-muted hover:text-fg bg-muted/5')} onClick={()=>setActive(t.path)}>
                <span className="font-mono truncate max-w-[180px]">{t.path.split('/').pop()}</span>
                {t.dirty && <span className="w-1.5 h-1.5 bg-signal rounded-full"/>}
                <button onClick={(e)=>{e.stopPropagation(); closeTab(t.path)}} className="hover:bg-muted/15 rounded p-0.5"><X className="w-3 h-3"/></button>
              </div>
            ))}
            {!tabs.length && <div className="px-3 py-1.5 text-xs text-muted">未打开任何文件</div>}
          </div>
          <div className="px-4 py-2 border-b border-rule flex items-center justify-between gap-2">
            <span className="truncate text-xs font-mono text-muted" title={current?.path}>{current?.path || '—'}</span>
            <div className="flex items-center gap-2">
              {current?.dirty && <Badge tone="signal">未保存</Badge>}
              <Button size="sm" disabled={!current || !current?.dirty} onClick={save}><Save className="w-3.5 h-3.5"/>保存</Button>
            </div>
          </div>
          {current ? (
            <Textarea value={current.content} onChange={e => setContent(e.target.value)} className="flex-1 font-mono text-xs resize-none rounded-none border-0 focus-visible:ring-0" spellCheck={false}/>
          ) : (
            <div className="flex-1 flex items-center justify-center"><EmptyState title="选择文件查看" desc="左侧浏览文件树点击进入。"/></div>
          )}
        </div>

        {/* Right pane */}
        <div className="bg-bg flex flex-col min-w-0">
          <div className="px-3 py-2 border-b border-rule flex gap-1 text-xs">
            {(['cli','shell','git'] as Mode[]).map(m => (
              <button key={m} onClick={() => setMode(m)} className={cn('px-2 py-1 rounded', mode===m?'bg-brand text-white':'hover:bg-muted/10 text-muted')}>{m.toUpperCase()}</button>
            ))}
            <span className="ml-auto text-muted truncate" title={dir}>cwd: {dir.replace('/home/admin','~')}</span>
          </div>
          <div className="flex-1 overflow-auto">
            {mode === 'cli' && <CliCollab cwd={dir} fileHint={current ? `当前打开:${current.path}` : ''} />}
            {mode === 'shell' && <ShellPanel cwd={dir} />}
            {mode === 'git' && <GitPanel cwd={dir} />}
          </div>
        </div>
      </div>
    </div>
  )
}

function CliCollab({ cwd, fileHint }: { cwd: string; fileHint: string }) {
  const { model, effort } = useCliPrefs()
  const [prompt, setPrompt] = useState('')
  const [out, setOut] = useState('')
  const [err, setErr] = useState('')
  const [running, setRunning] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const outRef = useRef<HTMLPreElement>(null)
  const { push } = useToast()
  useEffect(() => { outRef.current?.scrollTo({ top: 1e9 }) }, [out])

  const run = async () => {
    if (!prompt.trim()) return
    setRunning(true); setOut(''); setErr('')
    const ac = new AbortController(); abortRef.current = ac
    try {
      await streamCli({ cwd, prompt: (fileHint ? fileHint + '\n\n' : '') + prompt, effort, model: model || undefined }, (ev, d) => {
        if (ev === 'stdout') setOut(x => x + d.text)
        if (ev === 'stderr') setErr(x => x + d.text)
        if (ev === 'done') push(`code=${d.code}`, d.code === 0 ? 'success' : 'error')
        if (ev === 'error') push(d.message, 'error')
      })
    } catch (e: any) { push(String(e?.message || e), 'error') }
    finally { setRunning(false) }
  }

  return <div className="p-3 space-y-3 h-full flex flex-col">
    <Textarea rows={4} placeholder="问 Claude:例如「读 README 总结路线图」(⌘/Ctrl+Enter)" value={prompt}
      onChange={e=>setPrompt(e.target.value)}
      onKeyDown={e=>{ if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){e.preventDefault();run()} }}/>
    <div className="flex gap-2">
      <Button onClick={run} disabled={running||!prompt.trim()}><Play className="w-3.5 h-3.5"/>{running?'运行中':'运行'}</Button>
      {running && <Button variant="outline" onClick={()=>{abortRef.current?.abort();setRunning(false)}}><Square className="w-3.5 h-3.5"/>中止</Button>}
    </div>
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex items-center justify-between text-[11px] text-muted mb-1">
        <span>stdout</span>
        <button className="hover:text-brand" onClick={()=>{navigator.clipboard?.writeText(out);push('已复制 stdout','success')}} disabled={!out}>复制</button>
      </div>
      <pre ref={outRef} className="flex-1 text-xs bg-muted/10 p-3 rounded whitespace-pre-wrap overflow-auto">{out||'(stdout 等待运行)'}</pre>
    </div>
    {err && <pre className="text-xs text-signal max-h-32 overflow-auto whitespace-pre-wrap">{err}</pre>}
  </div>
}

function ShellPanel({ cwd }: { cwd: string }) {
  const [cmd, setCmd] = useState('')
  const [history, setHistory] = useState<{ cmd: string; out: string; err: string; code: number; cwd: string; ts: string }[]>([])
  const [hIdx, setHIdx] = useState(-1)
  const [running, setRunning] = useState(false)
  const outRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { push } = useToast()
  useEffect(() => { outRef.current?.scrollTo({ top: 1e9 }) }, [history.length, running])
  const run = async () => {
    const c = cmd.trim(); if (!c) return
    setRunning(true); setCmd('')
    try { const r = await apiPost<ShellResult>('/shell', { cwd, command: c, timeout: 120000 }); setHistory(h => [...h, { cmd: c, out: r.stdout, err: r.stderr, code: r.code, cwd: r.cwd, ts: new Date().toLocaleTimeString() }]) }
    catch (e: any) { push(String(e?.message || e), 'error') }
    finally { setRunning(false); setTimeout(() => inputRef.current?.focus(), 0) }
  }
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); run() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); const list = history.map(h => h.cmd); if (!list.length) return; const next = hIdx < 0 ? list.length - 1 : Math.max(0, hIdx - 1); setHIdx(next); setCmd(list[next]) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); const list = history.map(h => h.cmd); if (hIdx < 0) return; const next = hIdx + 1; if (next >= list.length) { setHIdx(-1); setCmd('') } else { setHIdx(next); setCmd(list[next]) } }
  }
  return <div className="h-full flex flex-col">
    <div ref={outRef} className="flex-1 overflow-auto p-3 font-mono text-xs space-y-3 bg-muted/5">
      {history.length === 0 && <div className="text-muted">输入命令后 Enter 运行;↑/↓ 浏览历史;cwd:{cwd}</div>}
      {history.map((h, i) => <div key={i}>
        <div className="text-muted">[{h.ts}] $ <span className="text-fg">{h.cmd}</span></div>
        {h.out && <pre className="whitespace-pre-wrap">{h.out}</pre>}
        {h.err && <pre className="whitespace-pre-wrap text-signal">{h.err}</pre>}
        <div className="text-[10px] text-muted">code={h.code}</div>
      </div>)}
      {running && <div className="text-muted">running…</div>}
    </div>
    <div className="flex items-center gap-2 border-t border-rule p-2 bg-bg">
      <span className="text-xs text-muted font-mono">$</span>
      <Input ref={inputRef} value={cmd} onChange={e=>{setCmd(e.target.value);setHIdx(-1)}} onKeyDown={onKey} placeholder="输入 shell 命令…" className="flex-1" disabled={running}/>
    </div>
  </div>
}

function GitPanel({ cwd }: { cwd: string }) {
  const git = useAsync<GitStatus>(() => apiGet('/git/status?dir=' + encodeURIComponent(cwd)), [cwd])
  const diff = useAsync<{ diff: string; error: string }>(() => apiGet('/git/diff?dir=' + encodeURIComponent(cwd)), [cwd])
  return <div className="p-3 space-y-3 h-full flex flex-col">
    <div className="flex items-center gap-2 text-sm"><GitBranch className="w-4 h-4 text-brand"/>{git.data?.branch || '—'}<Button size="sm" variant="outline" onClick={()=>{git.reload();diff.reload()}} className="ml-auto"><RefreshCw className="w-3.5 h-3.5"/>刷新</Button></div>
    {git.loading && <Skeleton className="h-20"/>}
    {git.data && <pre className="text-xs bg-muted/10 p-2 rounded whitespace-pre-wrap overflow-auto max-h-32">{git.data.status || '(working tree clean)'}</pre>}
    <div className="flex-1 flex flex-col min-h-0">
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted mb-1">git diff</div>
      <pre className="flex-1 text-xs bg-muted/10 p-3 rounded overflow-auto whitespace-pre"><DiffView text={diff.data?.diff || '(no diff)'}/></pre>
    </div>
    {git.data?.log && <details className="text-xs"><summary className="text-muted cursor-pointer">最近 commits</summary><pre className="text-xs bg-muted/10 p-3 rounded mt-1 whitespace-pre-wrap overflow-auto max-h-32">{git.data.log}</pre></details>}
  </div>
}
function DiffView({ text }: { text: string }) {
  return <>{text.split('\n').map((l, i) => <div key={i} className={l.startsWith('+') && !l.startsWith('+++') ? 'text-emerald-600 dark:text-emerald-400' : l.startsWith('-') && !l.startsWith('---') ? 'text-signal' : l.startsWith('@@') ? 'text-brand' : 'text-fg'}>{l}</div>)}</>
}
