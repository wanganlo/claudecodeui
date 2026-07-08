// Claude Code GUI 后端 V2: Chat + CLI/Agents/Jobs/Skills/MCP/Sessions 管理 API
import http from 'node:http'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { exec, spawn } from 'node:child_process'
import { homedir } from 'node:os'
import path from 'node:path'

const PORT = Number(process.env.PORT || 9181)
const HOST = process.env.HOST || '127.0.0.1'
const BASE = process.env.ANTHROPIC_BASE_URL
const KEY  = process.env.ANTHROPIC_API_KEY
const MODEL = process.env.CLAUDE_UI_MODEL || process.env.ANTHROPIC_MODEL || 'ark-code-latest'
const HOME = homedir()
const CLAUDE_DIR = path.join(HOME, '.claude')

function json(res, data, code = 200) {
  res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': '*' })
  res.end(JSON.stringify(data))
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let buf = ''
    req.setEncoding('utf8')
    req.on('data', c => { buf += c; if (buf.length > 16 * 1024 * 1024) { reject(new Error('payload too large (>16MB)')); req.destroy() } })
    req.on('end', () => { try { resolve(JSON.parse(buf || '{}')) } catch (e) { reject(e) } })
    req.on('error', reject)
  })
}
const safeRead = (p, fallback = '') => { try { return readFileSync(p, 'utf8') } catch { return fallback } }
const safeStat = (p) => { try { return statSync(p) } catch { return null } }
const safeReaddir = (p) => { try { return readdirSync(p) } catch { return [] } }
function runCmd(cmd, timeout = 15000) {
  return new Promise(resolve => {
    exec(cmd, { timeout, maxBuffer: 4 * 1024 * 1024, env: process.env }, (err, stdout, stderr) => {
      resolve({ code: err ? (err.code || 1) : 0, stdout: stdout || '', stderr: stderr || '' })
    })
  })
}

async function handleChat(req, res) {
  let body
  try { body = await readJson(req) } catch (e) { return json(res, { error: 'bad json: ' + e.message }, 400) }
  const messages = Array.isArray(body.messages) ? body.messages : []
  const system = typeof body.system === 'string' ? body.system : '你是 Claude Code GUI 里的 Claude。回答简洁、可靠,中文优先。'
  if (!messages.length) return json(res, { error: 'messages required' }, 400)
  res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-transform', 'connection': 'keep-alive', 'x-accel-buffering': 'no' })
  const sse = (ev, data) => { res.write(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`) }
  let closed = false; req.on('close', () => { closed = true })
  try {
    const up = await fetch(BASE.replace(/\/$/, '') + '/v1/messages', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: body.model || MODEL, max_tokens: Number(body.max_tokens || 2048), system, messages, stream: true }),
    })
    if (!up.ok || !up.body) { const t = await up.text().catch(() => ''); sse('error', { status: up.status, message: t.slice(0, 500) || 'upstream error' }); return res.end() }
    const reader = up.body.getReader(); const decoder = new TextDecoder(); let buf = ''
    while (true) {
      if (closed) { try { reader.cancel() } catch {}; break }
      const { value, done } = await reader.read(); if (done) break
      buf += decoder.decode(value, { stream: true })
      let idx
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const frame = buf.slice(0, idx); buf = buf.slice(idx + 2)
        let ev = 'message', data = ''
        for (const l of frame.split('\n')) { if (l.startsWith('event:')) ev = l.slice(6).trim(); else if (l.startsWith('data:')) data += l.slice(5).trim() }
        if (!data) continue
        let p; try { p = JSON.parse(data) } catch { continue }
        if (ev === 'content_block_delta') { const t = p?.delta?.text; if (typeof t === 'string' && t.length) sse('delta', { text: t }) }
        else if (ev === 'message_stop') sse('done', { ok: true })
        else if (ev === 'error') sse('error', { message: p?.error?.message || 'upstream error' })
      }
    }
    sse('done', { ok: true }); res.end()
  } catch (e) { sse('error', { message: String(e?.message || e) }); res.end() }
}

async function handleAgents(res) {
  const { stdout } = await runCmd('claude agents --json 2>/dev/null', 10000)
  try { json(res, JSON.parse(stdout)) } catch { json(res, []) }
}
async function handleJobs(res) {
  const jobsDir = path.join(CLAUDE_DIR, 'jobs')
  const ids = safeReaddir(jobsDir).filter(d => /^[a-f0-9]{8}$/.test(d))
  const items = ids.map(id => {
    let s = {}; try { s = JSON.parse(safeRead(path.join(jobsDir, id, 'state.json'), '{}')) } catch {}
    const lines = safeRead(path.join(jobsDir, id, 'timeline.jsonl'), '').trim().split('\n').filter(Boolean)
    let lastEvent = null; try { lastEvent = lines.length ? JSON.parse(lines[lines.length - 1]) : null } catch {}
    return { id, state: s.state || 'unknown', detail: s.detail || '', intent: s.intent || '', result: s.output?.result || '', name: s.name || id, cwd: s.cwd || '', createdAt: s.createdAt || '', updatedAt: s.updatedAt || '', tempo: s.tempo || 'idle', inFlight: s.inFlight || { tasks: 0, queued: 0, kinds: [] }, sessionId: s.sessionId || '', cliVersion: s.cliVersion || '', timelineEvents: lines.length, lastEvent }
  }).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''))
  json(res, items)
}
async function handleSkills(res) {
  const dir = path.join(CLAUDE_DIR, 'skills')
  const items = safeReaddir(dir).filter(n => !n.startsWith('.')).map(name => {
    const d = path.join(dir, name); const md = safeRead(path.join(d, 'SKILL.md')) || safeRead(path.join(d, 'skill.md')) || safeRead(path.join(d, 'README.md'))
    const desc = md.match(/^description:\s*"?(.+?)"?$/m)?.[1] || md.match(/^#\s+(.+)$/m)?.[1] || ''
    const st = safeStat(path.join(d, 'SKILL.md')) || safeStat(path.join(d, 'skill.md')) || safeStat(path.join(d, 'README.md'))
    return { name, description: desc.trim().slice(0, 240), files: safeReaddir(d).length, size: st?.size || 0, modified: st ? st.mtime.toISOString() : '' }
  }).sort((a,b)=>a.name.localeCompare(b.name))
  json(res, items)
}
async function handleMcp(res) {
  const { stdout, stderr } = await runCmd('claude mcp list 2>&1', 15000)
  const servers = (stdout + stderr).split('\n').map(line => {
    const m = line.match(/^([\w-]+):\s*(.+?)\s*-\s*(.+)$/); return m ? { name: m[1], command: m[2].trim(), status: m[3].trim() } : null
  }).filter(Boolean)
  json(res, servers)
}
async function handleSessions(res) {
  const root = path.join(CLAUDE_DIR, 'projects')
  const items = []
  for (const project of safeReaddir(root)) for (const f of safeReaddir(path.join(root, project)).filter(x => x.endsWith('.jsonl'))) {
    const fp = path.join(root, project, f); const st = safeStat(fp)
    items.push({ sessionId: f.replace(/\.jsonl$/, ''), project, size: st?.size || 0, created: st ? st.birthtime.toISOString() : '', modified: st ? st.mtime.toISOString() : '' })
  }
  json(res, items.sort((a,b)=>b.modified.localeCompare(a.modified)).slice(0,500))
}
async function handleRun(req, res) {
  let body; try { body = await readJson(req) } catch (e) { return json(res, { error: 'bad json: ' + e.message }, 400) }
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
  if (!prompt) return json(res, { error: 'prompt required' }, 400)
  const flags = typeof body.flags === 'string' ? body.flags : ''
  const { code, stdout, stderr } = await runCmd(`claude -p --bare ${flags} ${JSON.stringify(prompt)}`, Number(body.timeout || 120000))
  json(res, { code, stdout, stderr, prompt })
}
async function handleDaemon(res) { try { json(res, JSON.parse(safeRead(path.join(CLAUDE_DIR, 'daemon.status.json'), '{}'))) } catch { json(res, {}) } }
async function handleConfig(res) { try { json(res, JSON.parse(safeRead(path.join(CLAUDE_DIR, 'settings.json'), '{}'))) } catch { json(res, {}) } }

function withinHome(p) {
  const resolved = path.resolve(p || HOME)
  if (!resolved.startsWith(HOME)) throw new Error('path outside home is not allowed')
  return resolved
}
function shellEscape(v) { return JSON.stringify(String(v || '')) }
function sseHeaders(res) { res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-transform', 'connection': 'keep-alive', 'x-accel-buffering': 'no' }) }
async function handleCliStream(req, res) {
  let body; try { body = await readJson(req) } catch (e) { return json(res, { error: 'bad json: ' + e.message }, 400) }
  const prompt = String(body.prompt || '').trim(); if (!prompt) return json(res, { error: 'prompt required' }, 400)
  let cwd; try { cwd = withinHome(body.cwd || process.cwd()) } catch(e) { return json(res, { error: e.message }, 400) }
  const args = ['-p', '--bare']
  if (body.model) args.push('--model', String(body.model))
  if (body.effort) args.push('--effort', String(body.effort))
  if (body.permissionMode) args.push('--permission-mode', String(body.permissionMode))
  if (Array.isArray(body.addDirs)) for (const d of body.addDirs) args.push('--add-dir', withinHome(d))
  if (Array.isArray(body.allowedTools) && body.allowedTools.length) args.push('--allowedTools', body.allowedTools.join(','))
  if (Array.isArray(body.disallowedTools) && body.disallowedTools.length) args.push('--disallowedTools', body.disallowedTools.join(','))
  if (body.extraFlags) args.push(...String(body.extraFlags).split(/\s+/).filter(Boolean))
  args.push(prompt)
  sseHeaders(res); const send = (ev, data) => res.write(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`)
  const child = spawn('bash', ['-lc', 'claude ' + args.map(a=>JSON.stringify(a)).join(' ') + ' </dev/null'], { cwd, env: process.env })
  req.on('close', () => { try { child.kill('SIGTERM') } catch {} })
  child.stdout.on('data', d => send('stdout', { text: d.toString() }))
  child.stderr.on('data', d => send('stderr', { text: d.toString() }))
  child.on('error', e => { send('error', { message: e.message }); res.end() })
  child.on('close', code => { send('done', { code }); res.end() })
}
async function handleShell(req, res) {
  let body; try { body = await readJson(req) } catch (e) { return json(res, { error: 'bad json: ' + e.message }, 400) }
  const command = String(body.command || '').trim(); if (!command) return json(res, { error: 'command required' }, 400)
  let cwd; try { cwd = withinHome(body.cwd || HOME) } catch(e) { return json(res, { error: e.message }, 400) }
  const { code, stdout, stderr } = await runCmd(`cd ${shellEscape(cwd)} && ${command}`, Number(body.timeout || 120000))
  json(res, { code, stdout, stderr, cwd, command })
}
function handleFsList(url, res) {
  let dir; try { dir = withinHome(url.searchParams.get('dir') || path.join(HOME, 'files', 'projects')) } catch(e) { return json(res, { error: e.message }, 400) }
  const entries = safeReaddir(dir).map(name => { const fp = path.join(dir, name); const st = safeStat(fp); return { name, path: fp, type: st?.isDirectory() ? 'dir' : 'file', size: st?.size || 0, modified: st ? st.mtime.toISOString() : '' } }).sort((a,b)=> (a.type===b.type ? a.name.localeCompare(b.name) : a.type==='dir' ? -1 : 1))
  json(res, { dir, parent: path.dirname(dir), entries })
}
function handleFsRead(url, res) {
  let file; try { file = withinHome(url.searchParams.get('file') || '') } catch(e) { return json(res, { error: e.message }, 400) }
  const st = safeStat(file); if (!st || !st.isFile()) return json(res, { error: 'file not found' }, 404)
  if (st.size > 1024 * 1024) return json(res, { error: 'file too large (>1MB)' }, 413)
  json(res, { file, content: safeRead(file), size: st.size, modified: st.mtime.toISOString() })
}
async function handleFsWrite(req, res) {
  let body; try { body = await readJson(req) } catch (e) { return json(res, { error: 'bad json: ' + e.message }, 400) }
  let file; try { file = withinHome(body.file || '') } catch(e) { return json(res, { error: e.message }, 400) }
  const { writeFileSync } = await import('node:fs'); writeFileSync(file, String(body.content ?? ''), 'utf8'); json(res, { ok: true, file })
}
async function handleGitStatus(url, res) {
  let cwd; try { cwd = withinHome(url.searchParams.get('dir') || process.cwd()) } catch(e) { return json(res, { error: e.message }, 400) }
  const [status, branch, log] = await Promise.all([runCmd(`cd ${shellEscape(cwd)} && git status --short --branch`, 10000), runCmd(`cd ${shellEscape(cwd)} && git branch --show-current`, 10000), runCmd(`cd ${shellEscape(cwd)} && git log --oneline -5`, 10000)])
  json(res, { cwd, branch: branch.stdout.trim(), status: status.stdout, log: log.stdout, error: status.stderr || branch.stderr || log.stderr })
}
function handleJobTimeline(url, res) {
  const id = String(url.searchParams.get('id') || '').replace(/[^a-f0-9]/g, '').slice(0,8); if (!id) return json(res, { error: 'id required' }, 400)
  const events = safeRead(path.join(CLAUDE_DIR, 'jobs', id, 'timeline.jsonl'), '').trim().split('\n').filter(Boolean).slice(-300).map(l => { try { return JSON.parse(l) } catch { return { raw: l } } })
  json(res, { id, events })
}


function handleSkillDetail(url, res) {
  const name = String(url.searchParams.get('name') || '').replace(/[^a-zA-Z0-9_.-]/g, '')
  if (!name) return json(res, { error: 'name required' }, 400)
  const dir = path.join(CLAUDE_DIR, 'skills', name)
  const files = safeReaddir(dir)
  const md = safeRead(path.join(dir, 'SKILL.md')) || safeRead(path.join(dir, 'skill.md')) || safeRead(path.join(dir, 'README.md'))
  json(res, { name, files, content: md.slice(0, 64*1024) })
}


async function handleGitDiff(url, res) {
  let cwd; try { cwd = withinHome(url.searchParams.get('dir') || process.cwd()) } catch(e) { return json(res, { error: e.message }, 400) }
  const file = url.searchParams.get('path') || ''
  const cmd = `cd ${shellEscape(cwd)} && git diff --no-color -- ${file ? shellEscape(file) : ''}`
  const r = await runCmd(cmd, 15000)
  json(res, { cwd, file, diff: r.stdout, error: r.stderr })
}
async function handleMcpGet(url, res) {
  const name = String(url.searchParams.get('name') || '').replace(/[^\w-]/g, '')
  if (!name) return json(res, { error: 'name required' }, 400)
  const r = await runCmd(`claude mcp get ${shellEscape(name)} 2>&1`, 15000)
  json(res, { name, output: r.stdout })
}


async function handleLogs(url, res) {
  const source = String(url.searchParams.get('source') || 'service')
  const n = Math.min(2000, Math.max(20, Number(url.searchParams.get('n') || 200)))
  const cmds = {
    service: `journalctl -u claude-ui-server.service -n ${n} --no-pager 2>&1 | tail -${n}`,
    daemon: `tail -n ${n} ${shellEscape(path.join(CLAUDE_DIR, 'daemon.log'))} 2>&1`,
    nginx: `tail -n ${n} /var/log/nginx/access.log 2>&1 | grep /claude/ | tail -${n}`,
  }
  const cmd = cmds[source] || cmds.service
  const r = await runCmd(cmd, 15000)
  json(res, { source, lines: (r.stdout || r.stderr).split('\n').slice(-n) })
}


function handleSessionDetail(url, res) {
  const id = String(url.searchParams.get('id') || '').replace(/[^a-f0-9-]/g, '')
  const project = String(url.searchParams.get('project') || '').replace(/[^a-zA-Z0-9_.-]/g, '')
  if (!id || !project) return json(res, { error: 'id and project required' }, 400)
  const fp = path.join(CLAUDE_DIR, 'projects', project, id + '.jsonl')
  const raw = safeRead(fp, '')
  const lines = raw.trim().split('\n').filter(Boolean)
  const events = []
  for (const l of lines) {
    try {
      const e = JSON.parse(l)
      const ev = e.event || e.type || ''
      let text = ''
      if (Array.isArray(e.content)) text = e.content.map(c => typeof c === 'string' ? c : c.text || '').join('')
      else if (typeof e.message?.content === 'string') text = e.message.content
      else if (Array.isArray(e.message?.content)) text = e.message.content.map(c => c.text || '').join('')
      else if (typeof e.text === 'string') text = e.text
      events.push({ event: ev, role: e.role || e.message?.role || '', text: text.slice(0, 4000), ts: e.timestamp || e.ts || '' })
    } catch {}
  }
  json(res, { id, project, events: events.slice(-200) })
}


async function handleFsMkdir(req, res) {
  let body; try { body = await readJson(req) } catch (e) { return json(res, { error: 'bad json: ' + e.message }, 400) }
  let dir; try { dir = withinHome(body.dir || '') } catch(e) { return json(res, { error: e.message }, 400) }
  const { mkdirSync } = await import('node:fs'); mkdirSync(dir, { recursive: true }); json(res, { ok: true, dir })
}
async function handleFsRename(req, res) {
  let body; try { body = await readJson(req) } catch (e) { return json(res, { error: 'bad json: ' + e.message }, 400) }
  let from, to; try { from = withinHome(body.from || ''); to = withinHome(body.to || '') } catch(e) { return json(res, { error: e.message }, 400) }
  const { renameSync } = await import('node:fs'); renameSync(from, to); json(res, { ok: true, from, to })
}
async function handleFsDelete(req, res) {
  let body; try { body = await readJson(req) } catch (e) { return json(res, { error: 'bad json: ' + e.message }, 400) }
  let target; try { target = withinHome(body.path || '') } catch(e) { return json(res, { error: e.message }, 400) }
  const { rmSync } = await import('node:fs'); rmSync(target, { recursive: true, force: true }); json(res, { ok: true, path: target })
}

async function handleStatus(res) {
  const agents = await runCmd('claude agents --json 2>/dev/null', 8000).then(r => { try { return JSON.parse(r.stdout).length } catch { return 0 } })
  const jobs = safeReaddir(path.join(CLAUDE_DIR, 'jobs')).filter(d=>/^[a-f0-9]{8}$/.test(d)).length
  const skills = safeReaddir(path.join(CLAUDE_DIR, 'skills')).filter(d=>!d.startsWith('.')).length
  const sessions = safeReaddir(path.join(CLAUDE_DIR, 'projects')).reduce((a,d)=>a+safeReaddir(path.join(CLAUDE_DIR,'projects',d)).filter(f=>f.endsWith('.jsonl')).length,0)
  const mcp = await runCmd('claude mcp list 2>&1', 8000).then(r => (r.stdout+r.stderr).split('\n').filter(l=>l.includes(' - ')).length)
  json(res, { ok: true, model: MODEL, agents, jobs, skills, sessions, mcp, time: new Date().toISOString() })
}

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://x').pathname
  if (pathname === '/health' || pathname === '/api/health') return json(res, { ok: true, model: MODEL })
  if (pathname === '/api/chat' || pathname === '/chat') { if (req.method !== 'POST') return json(res, { error: 'POST required' }, 405); return handleChat(req, res) }
  if (pathname === '/api/agents') return handleAgents(res)
  if (pathname === '/api/jobs') return handleJobs(res)
  if (pathname === '/api/skills') return handleSkills(res)
  if (pathname === '/api/skills/detail') return handleSkillDetail(new URL(req.url, 'http://x'), res)
  if (pathname === '/api/mcp') return handleMcp(res)
  if (pathname === '/api/sessions') return handleSessions(res)
  if (pathname === '/api/daemon') return handleDaemon(res)
  if (pathname === '/api/config') return handleConfig(res)
  if (pathname === '/api/status') return handleStatus(res)

  if (pathname === '/api/cli/stream') { if (req.method !== 'POST') return json(res, { error: 'POST required' }, 405); return handleCliStream(req, res) }
  if (pathname === '/api/shell') { if (req.method !== 'POST') return json(res, { error: 'POST required' }, 405); return handleShell(req, res) }
  if (pathname === '/api/fs/list') return handleFsList(new URL(req.url, 'http://x'), res)
  if (pathname === '/api/fs/read') return handleFsRead(new URL(req.url, 'http://x'), res)
  if (pathname === '/api/fs/write') { if (req.method !== 'POST') return json(res, { error: 'POST required' }, 405); return handleFsWrite(req, res) }
  if (pathname === '/api/fs/mkdir') { if (req.method !== 'POST') return json(res, { error: 'POST required' }, 405); return handleFsMkdir(req, res) }
  if (pathname === '/api/fs/rename') { if (req.method !== 'POST') return json(res, { error: 'POST required' }, 405); return handleFsRename(req, res) }
  if (pathname === '/api/fs/delete') { if (req.method !== 'POST') return json(res, { error: 'POST required' }, 405); return handleFsDelete(req, res) }
  if (pathname === '/api/git/status') return handleGitStatus(new URL(req.url, 'http://x'), res)
  if (pathname === '/api/git/diff') return handleGitDiff(new URL(req.url, 'http://x'), res)
  if (pathname === '/api/mcp/get') return handleMcpGet(new URL(req.url, 'http://x'), res)
  if (pathname === '/api/logs') return handleLogs(new URL(req.url, 'http://x'), res)
  if (pathname === '/api/sessions/detail') return handleSessionDetail(new URL(req.url, 'http://x'), res)
  if (pathname === '/api/jobs/timeline') return handleJobTimeline(new URL(req.url, 'http://x'), res)
  if (pathname === '/api/run') { if (req.method !== 'POST') return json(res, { error: 'POST required' }, 405); return handleRun(req, res) }
  json(res, { error: 'not found' }, 404)
})
server.listen(PORT, HOST, () => console.log(`[claude-ui-server v2] http://${HOST}:${PORT} model=${MODEL}`))
