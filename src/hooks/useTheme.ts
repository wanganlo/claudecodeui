import { useEffect, useState } from 'react'

export type ThemeName = 'claude' | 'modern-minimalist' | 'tech-innovation'
export type Mode = 'light' | 'dark'
const KEY_T = 'claude-ui:theme'
const KEY_M = 'claude-ui:mode'

export function useTheme() {
  const [theme, setTheme] = useState<ThemeName>(
    () => (localStorage.getItem(KEY_T) as ThemeName) || 'claude'
  )
  const [mode, setMode] = useState<Mode>(
    () => (localStorage.getItem(KEY_M) as Mode) || 'light'
  )
  useEffect(() => {
    const r = document.documentElement
    r.setAttribute('data-theme', theme)
    r.classList.toggle('dark', mode === 'dark')
    localStorage.setItem(KEY_T, theme)
    localStorage.setItem(KEY_M, mode)
  }, [theme, mode])
  return { theme, setTheme, mode, setMode, toggleMode: () => setMode(m => (m === 'dark' ? 'light' : 'dark')) }
}
