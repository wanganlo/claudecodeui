import type { ReactNode } from 'react'

export type Column<T> = { key: keyof T | string; header: ReactNode; render?: (row: T) => ReactNode; align?: 'left' | 'right' | 'center' }

export function Table<T extends { id: string | number }>({ columns, rows }: { columns: Column<T>[]; rows: T[] }) {
  return (
    <div className="border border-rule rounded-[var(--radius-card)] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/5 border-b border-rule">
            {columns.map(c => (
              <th
                key={String(c.key)}
                className={`px-4 py-2.5 font-medium text-muted text-${c.align ?? 'left'} text-[11px] uppercase tracking-[0.14em]`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className={i ? 'border-t border-rule' : ''}>
              {columns.map(c => (
                <td key={String(c.key)} className={`px-4 py-2.5 text-${c.align ?? 'left'}`}>
                  {c.render ? c.render(r) : (r as Record<string, ReactNode>)[c.key as string]}
                </td>
              ))}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-muted">无数据</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
