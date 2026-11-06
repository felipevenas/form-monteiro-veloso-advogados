import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  applyTheme,
  getInitialTheme,
  persistTheme,
  THEME_EVENT_NAME,
  ThemeContext,
  type Theme,
  type ThemeContextValue,
} from './themeContext'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof document === 'undefined') return 'light'
    const current = document.documentElement.dataset.theme
    return current === 'dark' ? 'dark' : current === 'light' ? 'light' : getInitialTheme()
  })

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    function handleThemeEvent(event: Event) {
      const next = (event as CustomEvent<Theme>).detail
      if (next === 'light' || next === 'dark') setThemeState(next)
    }

    window.addEventListener(THEME_EVENT_NAME, handleThemeEvent)
    return () => window.removeEventListener(THEME_EVENT_NAME, handleThemeEvent)
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme: (next) => {
        applyTheme(next)
        persistTheme(next)
        setThemeState(next)
        window.dispatchEvent(new CustomEvent<Theme>(THEME_EVENT_NAME, { detail: next }))
      },
      toggleTheme: () => {
        const next: Theme = theme === 'dark' ? 'light' : 'dark'
        applyTheme(next)
        persistTheme(next)
        setThemeState(next)
        window.dispatchEvent(new CustomEvent<Theme>(THEME_EVENT_NAME, { detail: next }))
      },
    }),
    [theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
