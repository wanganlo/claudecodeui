import { usePersistentState } from '@/hooks/usePersistentState'
export type CliPrefs = { model: string; effort: string }
export function useCliPrefs() {
  const [model, setModel] = usePersistentState<string>('cli:model', '')
  const [effort, setEffort] = usePersistentState<string>('cli:effort', 'low')
  return { model, setModel, effort, setEffort }
}
