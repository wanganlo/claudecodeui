import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Sparkles, Moon, Sun, LayoutGrid, MessageSquare, BarChart3, Home, Menu, X, TerminalSquare, MonitorCog, ScrollText, BookOpen } from 'lucide-react'
import { useTheme, type ThemeName } from '@/hooks/useTheme'
import { useCliPrefs } from '@/hooks/useCliPrefs'
import { Ruler, CommandPalette } from '@/components'
import { cn } from '@/utils/cn'

const THEMES: { id: ThemeName; label: string }[] = [
  { id: 'claude', label: 'Claude' },
  { id: 'modern-minimalist', label: 'Mini' },
  { id: 'tech-innovation', label: 'Tech' },
]
const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/components', label: 'Components', icon: LayoutGrid },
  { to: '/chat', label: 'Chat', icon: MessageSquare },
  { to: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { to: '/code', label: 'Code GUI', icon: TerminalSquare },
  { to: '/workbench', label: 'Workbench', icon: MonitorCog },
  { to: '/logs', label: 'Logs', icon: ScrollText },
  { to: '/docs', label: 'Docs', icon: BookOpen },
]

export default function AppLayout() {
  const { theme, setTheme, mode, toggleMode } = useTheme()
  const { model, setModel, effort, setEffort } = useCliPrefs()
  const loc = useLocation()
  const [navOpen, setNavOpen] = useState(false)

  const navItem = (n: typeof NAV[number]) => (
    <NavLink
      key={n.to}
      to={n.to}
      end={n.end}
      onClick={() => setNavOpen(false)}
      className={({ isActive }) =>
        cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-[var(--radius-button)]',
          isActive ? 'text-brand bg-brand/10' : 'text-muted hover:text-fg hover:bg-muted/10',
        )
      }
    >
      <n.icon className="w-3.5 h-3.5" /> {n.label}
    </NavLink>
  )

  return (
    <div className="min-h-screen bg-bg text-fg flex">
      {/* a11y: skip to main */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] focus:px-3 focus:py-1.5 focus:bg-brand focus:text-white focus:rounded"
      >
        跳到主内容
      </a>
      <Ruler />
      <CommandPalette />
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="px-4 sm:px-6 md:px-8 py-4 border-b border-rule/60 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-6 min-w-0">
            <div className="flex items-center gap-2 font-semibold tracking-tight">
              <Sparkles className="w-5 h-5 text-brand" /> Claude UI
            </div>
            <nav className="hidden md:flex items-center gap-1" aria-label="primary">
              {NAV.map(navItem)}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex border border-rule rounded-[var(--radius-button)] overflow-hidden text-xs" role="radiogroup" aria-label="theme">
              {THEMES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  aria-pressed={theme === t.id}
                  className={cn('px-2.5 py-1.5', theme === t.id ? 'bg-brand text-white' : 'hover:bg-muted/10')}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <select value={effort} onChange={e=>setEffort(e.target.value)} className="hidden md:block text-xs border border-rule rounded-[var(--radius-button)] bg-bg px-2 py-1.5" title="effort">{['low','medium','high','xhigh','max'].map(x=><option key={x} value={x}>{x}</option>)}</select>
            <input value={model} onChange={e=>setModel(e.target.value)} placeholder="model 覆写(留空用默认)" className="hidden lg:block text-xs border border-rule rounded-[var(--radius-button)] bg-bg px-2 py-1.5 w-44" />
            <button onClick={()=>{const e=new KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true});window.dispatchEvent(e)}} aria-label="命令面板" className="hidden sm:inline-flex items-center gap-1 px-2 py-1.5 text-xs border border-rule rounded-[var(--radius-button)] hover:bg-muted/10"><span className="text-muted">搜索…</span><kbd className="text-[10px] text-muted">⌘K</kbd></button>
            <button onClick={toggleMode} className="p-2 rounded-[var(--radius-button)] border border-rule hover:bg-muted/10" aria-label={`切换到${mode === 'dark' ? '浅色' : '深色'}模式`}>
              {mode === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setNavOpen(o => !o)}
              className="md:hidden p-2 rounded-[var(--radius-button)] border border-rule hover:bg-muted/10"
              aria-label="导航菜单"
              aria-expanded={navOpen}
            >
              {navOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* 移动端抽屉导航 */}
        {navOpen && (
          <div className="md:hidden border-b border-rule/60 px-4 py-3 flex flex-col gap-1">
            {NAV.map(navItem)}
            <div className="mt-2 pt-2 border-t border-rule/60 flex gap-1">
              {THEMES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={cn('flex-1 px-2.5 py-1.5 text-xs rounded border',
                    theme === t.id ? 'bg-brand text-white border-brand' : 'border-rule hover:bg-muted/10')}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <main id="main" key={loc.pathname} className="flex-1 px-4 sm:px-6 md:px-8 py-8 md:py-10 max-w-[1180px] w-full">
          <Outlet />
        </main>

        <footer className="px-4 sm:px-6 md:px-8 py-5 border-t border-rule/60 text-xs text-muted flex flex-wrap items-center justify-between gap-2">
          <span>Claude UI · v0.3 · 我的 UI 工作台</span>
          <span className="font-mono">{theme} / {mode}</span>
        </footer>
      </div>
    </div>
  )
}
