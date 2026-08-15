"use client"
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AppSessionProvider, useAppSession } from '../../lib/AppSessionContext'
import { buttonClasses } from '../../components/ui/Button'
import { CommandPalette } from '../../components/CommandPalette'
import { TimesheetHeartbeat } from '../../components/TimesheetHeartbeat'

const Sidebar = dynamic(() => import('../../components/Sidebar').then((m) => m.Sidebar), { ssr: false })

function AppShell({ children }: { children: React.ReactNode }) {
  const { userId, loading, isPlatformAdmin } = useAppSession()
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (loading) return null

  if (!userId) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface px-6">
        <div className="flex flex-col items-start gap-4 rounded-xl border border-border bg-background p-8">
          <p className="text-sm text-foreground">Você não está autenticado.</p>
          <Link href="/auth/signin" className={buttonClasses('primary', 'sm')}>
            Entrar
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-dvh bg-surface">
      <Sidebar userId={userId} isPlatformAdmin={isPlatformAdmin} />
      <main className="flex-1 overflow-y-auto">{children}</main>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <TimesheetHeartbeat userId={userId} />
    </div>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppSessionProvider>
      <AppShell>{children}</AppShell>
    </AppSessionProvider>
  )
}
