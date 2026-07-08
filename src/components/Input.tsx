import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...rest }, ref) => (
    <input
      ref={ref}
      className={cn(
        'w-full h-9 px-3 text-sm bg-bg text-fg',
        'border border-rule rounded-[var(--radius-button)]',
        'placeholder:text-muted/70',
        'focus-visible:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30',
        'disabled:opacity-50',
        className,
      )}
      {...rest}
    />
  ),
)
Input.displayName = 'Input'
