"use client"
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { AppSessionProvider, useAppSession } from '../../lib/AppSessionContext'
import { buttonClasses } from '../../components/ui/Button'

const Sidebar = dynamic(() => import('../../components/Sidebar').then((m) => m.Sidebar), { ssr: false })

function AppShell({ children }: { children: React.ReactNode }) {
  const { userId, loading } = useAppSession()

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
      <Sidebar userId={userId} />
      <main className="flex-1 overflow-y-auto">{children}</main>
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
