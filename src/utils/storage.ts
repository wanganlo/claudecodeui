const PREFIX = 'claude-ui:'
export const storage = {
  get<T>(k: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(PREFIX + k)
      return raw == null ? fallback : (JSON.parse(raw) as T)
    } catch { return fallback }
  },
  set<T>(k: string, v: T) {
    try { localStorage.setItem(PREFIX + k, JSON.stringify(v)) } catch { /* noop */ }
  },
  del(k: string) { try { localStorage.removeItem(PREFIX + k) } catch { /* noop */ } },
}
