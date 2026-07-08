import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'
export function EmptyState({ title = '暂无数据', desc, action }: { title?: ReactNode; desc?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 rounded-full border border-rule flex items-center justify-center text-muted">
        <Inbox className="w-5 h-5" />
      </div>
      <div className="mt-4 font-medium">{title}</div>
      {desc && <div className="mt-1 text-sm text-muted max-w-[320px]">{desc}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
