import { streamCli as _streamCli } from './claudeApi'

export type ContentText = { type: 'text'; text: string }
export type ContentImage = { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
export type ContentBlock = ContentText | ContentImage
export type ApiMessage = { role: 'user' | 'assistant'; content: string | ContentBlock[] }

export async function streamChatRich(
  history: ApiMessage[],
  mode: 'chat' | 'cli',
  cwd: string,
  effort: string,
  model: string,
  onDelta: (text: string) => void,
  onStderr?: (text: string) => void,
) {
  if (mode === 'chat') {
    const res = await fetch('/claude/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: history, max_tokens: 2048, model: model || undefined }) })
    if (!res.ok || !res.body) throw new Error(await res.text().catch(() => res.statusText))
    const reader = res.body.getReader(); const decoder = new TextDecoder(); let buf = ''
    while (true) {
      const { value, done } = await reader.read(); if (done) break
      buf += decoder.decode(value, { stream: true })
      let idx
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const frame = buf.slice(0, idx); buf = buf.slice(idx + 2)
        let event = 'message', data = ''
        for (const line of frame.split('\n')) { if (line.startsWith('event:')) event = line.slice(6).trim(); if (line.startsWith('data:')) data += line.slice(5).trim() }
        if (!data) continue
        const payload = JSON.parse(data)
        if (event === 'delta') onDelta(payload.text || '')
        if (event === 'error') throw new Error(payload.message || '模型服务错误')
      }
    }
    return
  }
  // CLI 模式:把最后一条 user message 作为 prompt(并附上历史摘要),仅取 text 部分
  const flatten = (m: ApiMessage): string => {
    if (typeof m.content === 'string') return m.content
    return m.content.map(b => b.type === 'text' ? b.text : `[图片:${b.source.media_type}]`).join('\n')
  }
  const last = [...history].reverse().find(m => m.role === 'user')
  if (!last) throw new Error('no user message')
  const ctx = history.slice(-8).map(m => `[${m.role}] ${flatten(m)}`).join('\n\n')
  await _streamCli({ cwd, prompt: ctx, effort, model: model || undefined }, (ev, d) => {
    if (ev === 'stdout') onDelta(d.text)
    if (ev === 'stderr' && onStderr) onStderr(d.text)
    if (ev === 'error') throw new Error(d.message)
  })
}
export async function streamChat(messages: ApiMessage[], onDelta: (text: string) => void) {
  return streamChatRich(messages, 'chat', '', 'low', '', onDelta)
}
