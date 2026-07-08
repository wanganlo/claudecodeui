import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/utils/cn'
export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('border border-rule bg-bg rounded-[var(--radius-card)]', className)} {...rest}>
      {children}
    </div>
  )
}
export function CardHeader({ title, eyebrow, action }: { title: ReactNode; eyebrow?: ReactNode; action?: ReactNode }) {
  return (
    <div className="px-5 py-4 border-b border-rule flex items-start justify-between gap-3">
      <div>
        {eyebrow && <div className="text-[11px] uppercase tracking-[0.18em] text-muted">{eyebrow}</div>}
        <div className="mt-0.5 font-medium">{title}</div>
      </div>
      {action}
    </div>
  )
}
export function CardBody({ className, children }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)}>{children}</div>
}
