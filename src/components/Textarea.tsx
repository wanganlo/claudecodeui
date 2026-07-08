import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...rest }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'w-full min-h-[80px] px-3 py-2 text-sm bg-bg text-fg leading-relaxed',
        'border border-rule rounded-[var(--radius-button)] resize-y',
        'placeholder:text-muted/70',
        'focus-visible:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30',
        className,
      )}
      {...rest}
    />
  ),
)
Textarea.displayName = 'Textarea'
