import { useEffect, useMemo, useRef, useState } from 'react'
import { Send, Plus, MessageSquare, Trash2, Loader2, Wand2, Terminal, Paperclip, X, FileText } from 'lucide-react'
import { Button, Textarea, Badge, EmptyState, useToast } from '@/components'
import { usePersistentState } from '@/hooks/usePersistentState'
import { streamChatRich, type ApiMessage, type ContentBlock } from '@/utils/chatApi'
import { useCliPrefs } from '@/hooks/useCliPrefs'
import { cn } from '@/utils/cn'

type Attachment =
  | { id: string; kind: 'image'; name: string; mime: string; size: number; data: string /* base64, no prefix */; preview: string /* data url for <img> */ }
  | { id: string; kind: 'text';  name: string; mime: string; size: number; text: string }

type Msg = { id: string; role: 'user' | 'assistant'; text: string; ts: number; attachments?: Attachment[] }
type Thread = { id: string; title: string; updated: number; msgs: Msg[] }

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36)
const fmt = (t: number) => new Date(t).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
const fmtSize = (n: number) => n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`

const MAX_IMAGE_BYTES = 8 * 1024 * 1024     // 8MB / image
const MAX_TEXT_BYTES  = 256 * 1024          // 256KB / text
const MAX_TOTAL_BYTES = 12 * 1024 * 1024    // 12MB total per send

const seed = (): Thread[] => [
  {
    id: uid(), updated: Date.now(),
    title: '欢迎',
    msgs: [
      { id: uid(), role: 'assistant', ts: Date.now() - 60000,
        text: '欢迎使用 Claude UI 的对话模板。可点击 📎 上传文件、直接粘贴截图(⌘V),或拖文件到输入框。' },
      { id: uid(), role: 'assistant', ts: Date.now() - 30000,
        text: '支持图片(jpg/png/gif/webp)与文本(md/txt/json/log/code)。Enter 发送、Ctrl/⌘/Shift+Enter 换行。' },
    ],
  },
]

// --- 文件读取 ---
const readAsDataURL = (f: File) => new Promise<string>((res, rej) => {
  const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(f)
})
const readAsText = (f: File) => new Promise<string>((res, rej) => {
  const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsText(f)
})
const looksLikeText = (f: File) => /^text\//.test(f.type) || /\.(md|markdown|txt|log|json|ya?ml|toml|csv|tsv|js|ts|jsx|tsx|mjs|cjs|css|html?|sh|bash|zsh|py|rb|go|rs|java|c|h|cpp|hpp|cs|php|swift|kt|scala|sql|env|conf|ini|xml|svg|patch|diff|gitignore|dockerfile)$/i.test(f.name) || f.type === ''
const isImage = (f: File) => /^image\//.test(f.type)

async function fileToAttachment(f: File): Promise<Attachment | { error: string }> {
  if (isImage(f)) {
    if (f.size > MAX_IMAGE_BYTES) return { error: `${f.name} 超过 ${fmtSize(MAX_IMAGE_BYTES)} 上限` }
    const url = await readAsDataURL(f)
    const m = url.match(/^data:([^;]+);base64,(.*)$/); if (!m) return { error: `${f.name} 解析失败` }
    return { id: uid(), kind: 'image', name: f.name || 'image', mime: m[1], size: f.size, data: m[2], preview: url }
  }
  if (looksLikeText(f)) {
    if (f.size > MAX_TEXT_BYTES) return { error: `${f.name} 超过文本上限 ${fmtSize(MAX_TEXT_BYTES)}` }
    const text = await readAsText(f)
    return { id: uid(), kind: 'text', name: f.name, mime: f.type || 'text/plain', size: f.size, text }
  }
  return { error: `${f.name} 暂不支持的类型(${f.type || '未知'}),只接受图片或文本` }
}

export default function Chat() {
  const [threads, setThreads] = usePersistentState<Thread[]>('chat:threads', seed())
  const [activeId, setActiveId] = usePersistentState<string>('chat:active', threads[0]?.id ?? '')
  const [draft, setDraft] = useState('')
  const [atts, setAtts] = useState<Attachment[]>([])
  const [drag, setDrag] = useState(false)
  const [mode, setMode] = useState<'chat' | 'cli'>('chat')
  const { effort, model } = useCliPrefs()
  const [pending, setPending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const { push } = useToast()

  const active = useMemo(() => threads.find(t => t.id === activeId) ?? threads[0], [threads, activeId])
  // 没有任何会话时自动建一个,确保聊天窗永远可见
  useEffect(() => {
    if (threads.length === 0) {
      const t: Thread = { id: uid(), title: '新会话', updated: Date.now(), msgs: [] }
      setThreads([t]); setActiveId(t.id)
    } else if (!active) {
      setActiveId(threads[0].id)
    }
  }, [active, threads, setActiveId, setThreads])
  useEffect(() => { scrollRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }) }, [active?.msgs.length, pending])

  const totalBytes = useMemo(() =>
    atts.reduce((s, a) => s + (a.kind === 'image' ? a.size : a.size), 0), [atts])

  const addFiles = async (files: FileList | File[]) => {
    const list = Array.from(files); if (!list.length) return
    let added = 0
    for (const f of list) {
      const r = await fileToAttachment(f)
      if ('error' in r) { push(r.error, 'error'); continue }
      setAtts(prev => {
        const next = [...prev, r]
        const tot = next.reduce((s, a) => s + a.size, 0)
        if (tot > MAX_TOTAL_BYTES) { push(`总附件超过 ${fmtSize(MAX_TOTAL_BYTES)},已撤回 ${r.name}`, 'error'); return prev }
        return next
      })
      added++
    }
    if (added) push(`已附加 ${added} 个文件`, 'success')
  }

  const newThread = () => {
    const t: Thread = { id: uid(), title: '新会话', updated: Date.now(), msgs: [] }
    setThreads(ts => [t, ...ts])
    setActiveId(t.id)
  }
  const delThread = (id: string) => {
    setThreads(ts => ts.filter(t => t.id !== id))
    push('已删除会话', 'info')
  }

  const send = () => {
    const text = draft.trim()
    if ((!text && !atts.length) || !active) return

    const userMsg: Msg = { id: uid(), role: 'user', text, ts: Date.now(), attachments: atts.length ? atts : undefined }
    setThreads(ts => ts.map(t => t.id === active.id
      ? { ...t, updated: Date.now(),
          title: t.msgs.length === 0 ? (text || atts[0]?.name || '附件').slice(0, 24) : t.title,
          msgs: [...t.msgs, userMsg] }
      : t))
    setDraft(''); setAtts([])
    setPending(true)
    const replyId = uid()
    const assistantMsg: Msg = { id: replyId, role: 'assistant', text: '', ts: Date.now() }
    setThreads(ts => ts.map(t => t.id === active.id ? { ...t, msgs: [...t.msgs, assistantMsg], updated: Date.now() } : t))

    // 把 user msg 转为 Anthropic content blocks
    const toBlocks = (m: Msg): ApiMessage => {
      if (m.role === 'assistant') return { role: 'assistant', content: m.text || '' }
      const blocks: ContentBlock[] = []
      for (const a of m.attachments || []) {
        if (a.kind === 'image') blocks.push({ type: 'image', source: { type: 'base64', media_type: a.mime, data: a.data } })
        else blocks.push({ type: 'text', text: `[文件:${a.name}]\n\`\`\`\n${a.text}\n\`\`\`` })
      }
      if (m.text) blocks.push({ type: 'text', text: m.text })
      // 没附件时退化为字符串,保持向后兼容
      return blocks.length ? { role: 'user', content: blocks } : { role: 'user', content: m.text }
    }

    const history: ApiMessage[] = [...active.msgs, userMsg]
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-20)
      .map(toBlocks)

    streamChatRich(history, mode, '/home/admin/files/projects/claude-ui', effort, model, (chunk) => {
      setThreads(ts => ts.map(t => t.id === active.id
        ? { ...t, msgs: t.msgs.map(m => m.id === replyId ? { ...m, text: m.text + chunk } : m), updated: Date.now() }
        : t))
    }).then(() => {
      setPending(false)
    }).catch((err) => {
      setPending(false)
      const msg = String(err?.message || err)
      setThreads(ts => ts.map(t => t.id === active.id
        ? { ...t, msgs: t.msgs.map(m => m.id === replyId ? { ...m, text: `模型服务错误: ${msg}` } : m), updated: Date.now() }
        : t))
      push('模型服务错误', 'error')
    })
  }

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items
    const files: File[] = []
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      if (it.kind === 'file') { const f = it.getAsFile(); if (f) files.push(f) }
    }
    if (files.length) { e.preventDefault(); addFiles(files) }
  }
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDrag(false)
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-px bg-rule/60 border border-rule rounded-[var(--radius-card)] overflow-hidden h-[calc(100dvh-180px)] min-h-[560px]">
      {/* Sidebar */}
      <div className="bg-bg p-3 flex flex-col min-h-0">
        <Button size="sm" className="w-full justify-start" variant="outline" onClick={newThread}>
          <Plus className="w-4 h-4" /> 新会话
        </Button>
        <div className="mt-3 flex-1 overflow-auto space-y-1">
          {threads.length === 0 && (
            <div className="py-8 text-center text-sm text-muted">还没有会话</div>
          )}
          {threads.map(t => (
            <div
              key={t.id}
              className={cn(
                'group flex items-start gap-1 px-2.5 py-2 rounded-[var(--radius-button)] border border-transparent cursor-pointer',
                t.id === active?.id ? 'bg-brand/10 border-brand/30' : 'hover:bg-muted/10',
              )}
              onClick={() => setActiveId(t.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <MessageSquare className="w-3.5 h-3.5 text-muted shrink-0" />
                  <span className="truncate">{t.title || '未命名'}</span>
                </div>
                <div className="mt-0.5 text-xs text-muted truncate">
                  {t.msgs.at(-1)?.text || (t.msgs.at(-1)?.attachments?.length ? `📎 ${t.msgs.at(-1)!.attachments![0].name}` : '空会话')}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); delThread(t.id) }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted/15 rounded"
                aria-label="delete thread"
              >
                <Trash2 className="w-3.5 h-3.5 text-muted" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Conversation */}
      <div className="bg-bg flex flex-col min-w-0 relative"
        onDragOver={e => { e.preventDefault(); if (!drag) setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
      >
        {drag && (
          <div className="absolute inset-0 z-30 bg-brand/10 border-2 border-dashed border-brand flex items-center justify-center pointer-events-none">
            <div className="text-brand font-medium flex items-center gap-2"><Paperclip className="w-5 h-5" />松手添加文件</div>
          </div>
        )}
        {!active ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              title="还没有会话"
              desc="点击左上角新建一个会话开始聊天。所有内容仅保存在你浏览器本地。"
              action={<Button onClick={newThread}><Plus className="w-4 h-4" /> 新会话</Button>}
            />
          </div>
        ) : (
          <>
            <div className="px-5 py-3 border-b border-rule flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted">对话</div>
                <div className="font-medium truncate">{active.title || '未命名'}</div>
              </div>
              <Badge tone="brand">{active.msgs.length} 条</Badge>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-auto px-5 py-6 space-y-5">
              {active.msgs.length === 0 && !pending && (
                <EmptyState title="开始对话" desc="可粘贴截图、拖文件到这里,或在下方输入消息(Enter 发送 / Ctrl·⌘·Shift+Enter 换行)。" />
              )}
              {active.msgs.map(m => (
                <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    'max-w-[78%] px-4 py-2.5 text-sm leading-relaxed border whitespace-pre-wrap',
                    m.role === 'user'
                      ? 'bg-brand text-white border-brand rounded-[var(--radius-card)] rounded-tr-sm'
                      : 'bg-bg border-rule rounded-[var(--radius-card)] rounded-tl-sm',
                  )}>
                    {m.attachments?.length ? (
                      <div className="mb-2 flex flex-wrap gap-2 not-prose">
                        {m.attachments.map(a => a.kind === 'image' ? (
                          <a key={a.id} href={a.preview} target="_blank" rel="noreferrer">
                            <img src={a.preview} alt={a.name} className="max-h-40 max-w-[220px] rounded border border-white/30 object-cover" />
                          </a>
                        ) : (
                          <div key={a.id} className={cn(
                            'inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded border',
                            m.role === 'user' ? 'bg-white/15 border-white/30' : 'bg-muted/10 border-rule',
                          )}>
                            <FileText className="w-3 h-3" />
                            <span className="truncate max-w-[160px]">{a.name}</span>
                            <span className={cn('opacity-70', m.role === 'user' ? 'text-white/70' : 'text-muted')}>{fmtSize(a.size)}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {m.text}
                    <div className={cn('mt-1 text-[10px]', m.role === 'user' ? 'text-white/70' : 'text-muted')}>{fmt(m.ts)}</div>
                  </div>
                </div>
              ))}
              {pending && (
                <div className="flex justify-start">
                  <div className="px-4 py-2.5 text-sm border border-rule rounded-[var(--radius-card)] rounded-tl-sm bg-bg flex items-center gap-2 text-muted">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> 正在思考…
                  </div>
                </div>
              )}
            </div>
            <div className="border-t border-rule p-2 flex items-center gap-2 text-xs flex-wrap">
              <span className="text-muted">模式:</span>
              <button onClick={()=>setMode('chat')} className={mode==='chat' ? 'px-2 py-1 rounded bg-brand text-white inline-flex items-center gap-1' : 'px-2 py-1 rounded hover:bg-muted/10 inline-flex items-center gap-1'}><Wand2 className="w-3 h-3"/>Chat</button>
              <button onClick={()=>setMode('cli')} className={mode==='cli' ? 'px-2 py-1 rounded bg-brand text-white inline-flex items-center gap-1' : 'px-2 py-1 rounded hover:bg-muted/10 inline-flex items-center gap-1'}><Terminal className="w-3 h-3"/>CLI</button>
              <span className="text-muted">{mode==='cli' ? '(直接调本机 claude -p --bare,图片附件将被忽略)' : '(纯模型对话,支持图片+文本)'}</span>
            </div>

            {/* 附件预览 */}
            {atts.length > 0 && (
              <div className="border-t border-rule px-3 pt-2 flex flex-wrap gap-2">
                {atts.map(a => (
                  <div key={a.id} className="relative group border border-rule rounded-[var(--radius-button)] overflow-hidden bg-muted/5">
                    {a.kind === 'image' ? (
                      <img src={a.preview} alt={a.name} className="h-16 w-16 object-cover" />
                    ) : (
                      <div className="h-16 w-32 px-2 py-1 flex flex-col justify-center">
                        <div className="flex items-center gap-1 text-xs font-medium truncate"><FileText className="w-3 h-3 text-muted shrink-0" />{a.name}</div>
                        <div className="text-[10px] text-muted">{fmtSize(a.size)}</div>
                      </div>
                    )}
                    <button
                      onClick={() => setAtts(prev => prev.filter(x => x.id !== a.id))}
                      className="absolute top-0.5 right-0.5 p-0.5 bg-bg/80 border border-rule rounded opacity-80 hover:opacity-100"
                      aria-label="remove attachment"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <div className="text-[10px] text-muted self-end pb-1">
                  {atts.length} 项 · {fmtSize(totalBytes)} / {fmtSize(MAX_TOTAL_BYTES)}
                </div>
              </div>
            )}

            <div className="border-t border-rule p-3 flex items-end gap-2">
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/*,.md,.markdown,.txt,.log,.json,.yaml,.yml,.toml,.csv,.tsv,.js,.ts,.jsx,.tsx,.mjs,.cjs,.css,.html,.htm,.sh,.bash,.zsh,.py,.rb,.go,.rs,.java,.c,.h,.cpp,.cs,.php,.swift,.kt,.scala,.sql,.env,.conf,.ini,.xml,.svg,.patch,.diff,text/*"
                className="hidden"
                onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = '' }}
              />
              <Button
                variant="outline"
                size="md"
                onClick={() => fileRef.current?.click()}
                disabled={pending}
                aria-label="附加文件"
                title="附加文件 / 图片(也可以粘贴或拖入)"
              >
                <Paperclip className="w-4 h-4" />
              </Button>
              <Textarea
                rows={2}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onPaste={onPaste}
                onKeyDown={e => {
                  if (e.key !== 'Enter') return
                  // 中文/日文等 IME 拼写过程中的 Enter 不当作发送
                  if (e.nativeEvent.isComposing || (e as any).keyCode === 229) return
                  // Ctrl / ⌘ / Shift + Enter → 换行(放给 textarea 默认行为)
                  if (e.ctrlKey || e.metaKey || e.shiftKey) return
                  e.preventDefault(); send()
                }}
                placeholder="说点什么... Enter 发送 · Ctrl/⌘/Shift+Enter 换行 · ⌘V 粘贴截图"
                className="resize-none"
                disabled={pending}
              />
              <Button onClick={send} disabled={(!draft.trim() && !atts.length) || pending}>
                {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                发送
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
