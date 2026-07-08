export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch('/claude/api' + path)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch('/claude/api' + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
export type Status = { ok: boolean; model: string; agents: number; jobs: number; skills: number; sessions: number; mcp: number; time: string }
export type Agent = { pid: number; cwd: string; kind: string; startedAt: number; sessionId: string; name?: string; status?: string }
export type Job = { id: string; state: string; detail: string; intent: string; result: string; name: string; cwd: string; createdAt: string; updatedAt: string; tempo: string; inFlight: { tasks: number; queued: number; kinds: string[] }; sessionId: string; cliVersion: string; timelineEvents: number }
export type Skill = { name: string; description: string; files: number; size: number; modified: string }
export type Mcp = { name: string; command: string; status: string }
export type Session = { sessionId: string; project: string; size: number; created: string; modified: string }
export type RunResult = { code: number; stdout: string; stderr: string; prompt: string }
export type FsEntry = { name: string; path: string; type: 'dir' | 'file'; size: number; modified: string }
export type FsList = { dir: string; parent: string; entries: FsEntry[] }
export type FsRead = { file: string; content: string; size: number; modified: string }
export type GitStatus = { cwd: string; branch: string; status: string; log: string; error: string }
export type ShellResult = { code: number; stdout: string; stderr: string; cwd: string; command: string }
export async function streamCli(body: Record<string, unknown>, onEvent: (ev: string, data: any) => void) {
  const res = await fetch('/claude/api/cli/stream', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok || !res.body) throw new Error(await res.text())
  const reader = res.body.getReader(); const decoder = new TextDecoder(); let buf = ''
  while (true) {
    const { value, done } = await reader.read(); if (done) break
    buf += decoder.decode(value, { stream: true })
    let idx
    while ((idx = buf.indexOf('\n\n')) !== -1) {
      const frame = buf.slice(0, idx); buf = buf.slice(idx + 2)
      let ev = 'message', data = '{}'
      for (const l of frame.split('\n')) { if (l.startsWith('event:')) ev = l.slice(6).trim(); if (l.startsWith('data:')) data = l.slice(5).trim() }
      try { onEvent(ev, JSON.parse(data)) } catch { /* noop */ }
    }
  }
}
export type GitDiff = { cwd: string; file: string; diff: string; error: string }
