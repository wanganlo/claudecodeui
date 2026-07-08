import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/utils/cn'

type Toast = { id: number; msg: string; tone: 'info' | 'success' | 'error' }
type Ctx = { push: (msg: string, tone?: Toast['tone']) => void }
const ToastCtx = createContext<Ctx | null>(null)
export const useToast = () => {
  const c = useContext(ToastCtx); if (!c) throw new Error('ToastProvider missing'); return c
}
export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([])
  const idRef = useRef(0)
  const push = useCallback<Ctx['push']>((msg, tone = 'info') => {
    const id = ++idRef.current
    setList(l => [...l, { id, msg, tone }])
    setTimeout(() => setList(l => l.filter(t => t.id !== id)), 2600)
  }, [])
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
        {list.map(t => (
          <div
            key={t.id}
            className={cn(
              'px-3.5 py-2 text-sm border rounded-[var(--radius-button)] bg-bg shadow-md',
              t.tone === 'success' && 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400',
              t.tone === 'error' && 'border-signal text-signal',
              t.tone === 'info' && 'border-rule text-fg',
            )}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
