import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/shared/theme/themeContext'
import { cn } from '@/shared/lib/cn'

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
      aria-pressed={isDark}
      title={isDark ? 'Tema claro' : 'Tema escuro'}
      className={cn(
        'inline-flex min-h-10 items-center gap-2 rounded-[2px] px-2.5 text-[0.74rem] font-semibold text-text-2 transition hover:bg-blue-50 hover:text-brand',
        className,
      )}
    >
      {isDark ? (
        <Sun className="size-4" aria-hidden="true" />
      ) : (
        <Moon className="size-4" aria-hidden="true" />
      )}
      <span className="hidden md:inline">{isDark ? 'Claro' : 'Escuro'}</span>
    </button>
  )
}
