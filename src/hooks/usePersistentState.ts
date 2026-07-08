import { useEffect, useState } from 'react'
import { storage } from '@/utils/storage'
export function usePersistentState<T>(key: string, initial: T) {
  const [v, setV] = useState<T>(() => storage.get(key, initial))
  useEffect(() => { storage.set(key, v) }, [key, v])
  return [v, setV] as const
}
