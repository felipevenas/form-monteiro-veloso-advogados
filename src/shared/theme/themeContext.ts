import { createContext, useContext } from 'react'

export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'mv:theme'
export const THEME_CHOICE_KEY = 'mv:theme:chosen'
export const THEME_EVENT_NAME = 'mv:theme'

export interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'

  try {
    const chosen = window.localStorage.getItem(THEME_CHOICE_KEY)
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (chosen && (stored === 'light' || stored === 'dark')) return stored
  } catch {
    // localStorage indisponível: mantém o padrão claro.
  }

  // Padrão do produto: abrir no claro, independentemente do sistema.
  return 'light'
}

export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
}

/** Persiste apenas a escolha explícita do visitante. */
export function persistTheme(theme: Theme): void {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    window.localStorage.setItem(THEME_CHOICE_KEY, '1')
  } catch {
    // Sem persistência: a sessão atual ainda funciona.
  }
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error('useTheme deve ser usado dentro de ThemeProvider.')
  }

  return context
}
