/* Signature 元素:左侧刻度尺导航 */
export function Ruler() {
  return (
    <aside className="w-6 border-r border-rule/60 relative shrink-0 hidden md:block" aria-hidden>
      <div className="absolute inset-0 flex flex-col">
        {Array.from({ length: 60 }).map((_, i) => (
          <div
            key={i}
            className="border-t border-rule/40"
            style={{ flex: 1, marginLeft: i % 5 === 0 ? 0 : 12 }}
          />
        ))}
      </div>
    </aside>
  )
}
