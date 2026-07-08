import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ArrowRight, Layers, Bot, Briefcase, Wrench, Network, MonitorCog, Terminal, MessageSquare, Home as HomeIcon, BarChart3, BookOpen } from 'lucide-react'
import { apiGet } from '@/utils/claudeApi'
import { cn } from '@/utils/cn'

type Item = { id: string; title: string; subtitle?: string; icon: any; action: () => void; group: string }

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); setOpen(true)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  useEffect(() => {
    if (!open) return
    setActive(0); setQ('')
    inputRef.current?.focus()
    const base: Item[] = [
      { id:'nav-home', title:'前往 · 首页', icon: HomeIcon, action:()=>navigate('/'), group:'导航' },
      { id:'nav-comp', title:'前往 · 组件展示', icon: Layers, action:()=>navigate('/components'), group:'导航' },
      { id:'nav-chat', title:'前往 · Chat', icon: MessageSquare, action:()=>navigate('/chat'), group:'导航' },
      { id:'nav-dash', title:'前往 · Dashboard', icon: BarChart3, action:()=>navigate('/dashboard'), group:'导航' },
      { id:'nav-code', title:'前往 · Claude Code GUI', icon: Terminal, action:()=>navigate('/code'), group:'导航' },
      { id:'nav-wb',   title:'前往 · Workbench', icon: MonitorCog, action:()=>navigate('/workbench'), group:'导航' },
      { id:'nav-docs', title:'前往 · 文档站', icon: BookOpen, action:()=>navigate('/docs'), group:'导航' },
    ]
    setItems(base)
    Promise.all([
      apiGet<any[]>('/agents').catch(()=>[]),
      apiGet<any[]>('/jobs').catch(()=>[]),
      apiGet<any[]>('/skills').catch(()=>[]),
      apiGet<any[]>('/mcp').catch(()=>[]),
    ]).then(([agents, jobs, skills, mcp]) => {
      setItems([
        ...base,
        ...agents.slice(0, 30).map(a => ({ id:'a-'+a.sessionId, title: a.name || a.sessionId, subtitle: `${a.kind} · ${a.status||''}`, icon: Bot, action:()=>navigate('/code'), group:'Agent' })),
        ...jobs.slice(0, 60).map(j => ({ id:'j-'+j.id, title: j.name || j.id, subtitle: j.intent || j.detail, icon: Briefcase, action:()=>navigate('/code'), group:'Job' })),
        ...skills.slice(0, 60).map(s => ({ id:'s-'+s.name, title: s.name, subtitle: s.description, icon: Wrench, action:()=>navigate('/code'), group:'Skill' })),
        ...mcp.slice(0, 20).map(m => ({ id:'m-'+m.name, title: m.name, subtitle: m.command, icon: Network, action:()=>navigate('/code'), group:'MCP' })),
      ])
    })
  }, [open, navigate])

  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase(); if (!k) return items
    return items.filter(i => (i.title + ' ' + (i.subtitle||'')).toLowerCase().includes(k))
  }, [q, items])

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i+1, filtered.length-1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i-1, 0)) }
    else if (e.key === 'Enter' && filtered[active]) { filtered[active].action(); setOpen(false) }
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[8vh]" onClick={()=>setOpen(false)}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-xl mx-4 bg-bg border border-rule rounded-[var(--radius-card)] shadow-xl" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center px-4 py-3 border-b border-rule">
          <Search className="w-4 h-4 text-muted mr-2" />
          <input ref={inputRef} value={q} onChange={e=>setQ(e.target.value)} onKeyDown={onKey} className="flex-1 bg-transparent outline-none text-sm" placeholder="跳转 / 搜索 agent / job / skill / mcp …" />
          <kbd className="text-[10px] text-muted">Esc</kbd>
        </div>
        <div className="max-h-[60vh] overflow-auto p-2">
          {filtered.length === 0 && <div className="p-4 text-sm text-muted">无匹配</div>}
          {filtered.slice(0, 80).map((it, i) => (
            <button key={it.id} onClick={() => { it.action(); setOpen(false) }}
              onMouseEnter={() => setActive(i)}
              className={cn('w-full text-left px-3 py-2 rounded flex items-center gap-3', i === active ? 'bg-brand/10' : 'hover:bg-muted/10')}>
              <it.icon className="w-4 h-4 text-muted shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{it.title}</div>
                {it.subtitle && <div className="text-xs text-muted truncate">{it.subtitle}</div>}
              </div>
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted">{it.group}</span>
              <ArrowRight className="w-3.5 h-3.5 text-muted" />
            </button>
          ))}
        </div>
        <div className="px-4 py-2 border-t border-rule text-[11px] text-muted flex justify-between">
          <span>↑↓ 选择 · ⏎ 跳转 · ⌘/Ctrl+K 切换</span>
          <span>{filtered.length} 项</span>
        </div>
      </div>
    </div>
  )
}
