import './globals.css'
import { ReactNode } from 'react'
import { ToastProvider } from '../components/ui/ToastProvider'
import { ThemeProvider } from '../lib/ThemeContext'

export const metadata = {
  title: 'Revollution Idea',
  description: 'MVP interno — boards e colaboração'
}

// Runs before paint so the theme class is already correct on first render —
// without this, the page would flash the light theme for a beat before
// React hydrates and applies the saved/OS-preferred dark theme.
const NO_FLASH_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('revollution-theme');
    var dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {}
})();
`

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
