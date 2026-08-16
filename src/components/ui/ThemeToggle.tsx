"use client"
import { Moon, Sun } from '@phosphor-icons/react/dist/ssr'
import { useTheme } from '../../lib/ThemeContext'

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      aria-label={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      className={`rounded-md p-1.5 text-muted-foreground hover:bg-surface hover:text-foreground ${className}`}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}
