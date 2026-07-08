import { useCallback, useEffect, useRef, useState } from 'react'
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[] = [], opts?: { interval?: number }) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loadingRef = useRef(false)
  const reload = useCallback(() => {
    if (loadingRef.current) return
    loadingRef.current = true; setLoading(true); setError(null)
    loader().then(setData).catch(e => setError(String(e?.message || e))).finally(() => { setLoading(false); loadingRef.current = false })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  useEffect(() => { reload() }, [reload])
  useEffect(() => {
    if (!opts?.interval) return
    const t = setInterval(reload, opts.interval)
    return () => clearInterval(t)
  }, [opts?.interval, reload])
  return { data, loading, error, reload }
}
