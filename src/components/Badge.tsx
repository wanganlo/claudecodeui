import type { HTMLAttributes } from 'react'
import { cn } from '@/utils/cn'
type Tone = 'neutral' | 'brand' | 'signal' | 'success'
const toneCls: Record<Tone, string> = {
  neutral: 'bg-muted/15 text-fg',
  brand: 'bg-brand/15 text-brand',
  signal: 'bg-signal/15 text-signal',
  success: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
}
export function Badge({ tone = 'neutral', className, ...rest }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return <span className={cn('inline-flex items-center px-2 py-0.5 text-xs font-medium rounded', toneCls[tone], className)} {...rest} />
}
