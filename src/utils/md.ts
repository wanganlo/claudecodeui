// 极简 Markdown → HTML(GFM 子集),仅本地渲染 SKILL.md/README.md 这类简单文档。
export function renderMd(src: string): string {
  let s = src
  s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  // code block
  s = s.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => `<pre class="bg-muted/10 p-3 rounded text-xs overflow-auto"><code class="language-${lang}">${code}</code></pre>`)
  // inline code
  s = s.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 bg-muted/15 rounded text-[12px]">$1</code>')
  // headings
  s = s.replace(/^###### (.+)$/gm, '<h6 class="font-semibold mt-3 text-sm">$1</h6>')
  s = s.replace(/^##### (.+)$/gm, '<h5 class="font-semibold mt-3 text-sm">$1</h5>')
  s = s.replace(/^#### (.+)$/gm, '<h4 class="font-semibold mt-4">$1</h4>')
  s = s.replace(/^### (.+)$/gm, '<h3 class="font-semibold mt-5 text-base">$1</h3>')
  s = s.replace(/^## (.+)$/gm, '<h2 class="font-bold mt-6 text-lg">$1</h2>')
  s = s.replace(/^# (.+)$/gm, '<h1 class="font-bold mt-2 text-xl">$1</h1>')
  // bold/italic
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  // unordered list
  s = s.replace(/(^|\n)((?:- .+\n?)+)/g, (_m, lead, block) => lead + '<ul class="list-disc pl-5 my-2 space-y-1">' + block.trim().split('\n').map((l: string) => '<li>' + l.replace(/^- /, '') + '</li>').join('') + '</ul>')
  // links
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-brand hover:underline" target="_blank" rel="noreferrer">$1</a>')
  // blockquote
  s = s.replace(/^> (.+)$/gm, '<blockquote class="border-l-2 border-rule pl-3 text-muted my-2">$1</blockquote>')
  // hr
  s = s.replace(/^---+$/gm, '<hr class="my-4 border-rule"/>')
  // paragraphs (split blank lines)
  s = s.split(/\n{2,}/).map(b => /^<(h\d|ul|ol|pre|blockquote|hr)/.test(b) ? b : `<p class="leading-relaxed my-2">${b.replace(/\n/g, '<br/>')}</p>`).join('\n')
  return s
}
