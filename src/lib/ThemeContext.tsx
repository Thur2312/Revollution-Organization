"use client"
import { createContext, useContext, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'revollution-theme'

type ThemeContextValue = {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'light', toggleTheme: () => {} })

// The actual light/dark class swap happens synchronously before paint via
// the inline script in src/app/layout.tsx (avoids a flash of the wrong
// theme) — this provider just mirrors that already-applied class into React
// state so components can read/toggle it.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light')
  }, [])

  function toggleTheme() {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      document.documentElement.classList.toggle('dark', next === 'dark')
      localStorage.setItem(STORAGE_KEY, next)
      return next
    })
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
