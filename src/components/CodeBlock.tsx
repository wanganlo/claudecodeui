import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { cn } from '@/utils/cn'

export function CodeBlock({ code, lang = 'tsx', className }: { code: string; lang?: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  const onCopy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1400) } catch { /* noop */ }
  }
  return (
    <div className={cn('relative group rounded-[var(--radius-card)] border border-rule bg-muted/5 overflow-hidden', className)}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-rule text-[11px] uppercase tracking-[0.14em] text-muted">
        <span>{lang}</span>
        <button
          onClick={onCopy}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-muted/15 text-muted hover:text-fg transition"
          aria-label="copy code"
        >
          {copied ? <><Check className="w-3 h-3" /> 已复制</> : <><Copy className="w-3 h-3" /> 复制</>}
        </button>
      </div>
      <pre className="p-3 text-[12.5px] leading-relaxed overflow-x-auto"><code>{code}</code></pre>
    </div>
  )
}
