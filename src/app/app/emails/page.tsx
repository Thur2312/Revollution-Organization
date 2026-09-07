"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Megaphone, SquaresFour } from '@phosphor-icons/react/dist/ssr'
import { supabase } from '../../../lib/supabaseClient'
import { useAppSession } from '../../../lib/AppSessionContext'

type Workspace = { id: string; name: string }

export default function ProspeccaoLandingPage() {
  const { userId } = useAppSession()
  const router = useRouter()
  const [hasNoWorkspace, setHasNoWorkspace] = useState(false)
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null)

  useEffect(() => {
    if (!userId) return
    let mounted = true
    async function load() {
      const { data: memberships } = await supabase
        .from('memberships')
        .select('workspace_id')
        .eq('user_id', userId)
      const ids = ((memberships ?? []) as { workspace_id: string }[]).map((m) => m.workspace_id)
      if (ids.length === 0) {
        if (mounted) setHasNoWorkspace(true)
        return
      }
      const { data: ws } = await supabase.from('workspaces').select('id, name').in('id', ids).order('name')
      const list = (ws ?? []) as Workspace[]
      if (!mounted) return
      if (list.length === 1) router.replace(`/app/workspace/${list[0].id}/emails`)
      else if (list.length > 1) setWorkspaces(list)
      else setHasNoWorkspace(true)
    }
    load()
    return () => {
      mounted = false
    }
  }, [userId, router])

  if (hasNoWorkspace) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight text-primary">Prospecção</h1>
        <p className="mb-8 text-sm text-muted-foreground">E-mails de prospecção, com modelo customizável.</p>

        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-14 text-center">
          <SquaresFour size={28} className="text-muted-foreground" />
          <p className="text-sm font-medium text-primary">Você ainda não tem um workspace</p>
          <p className="text-sm text-muted-foreground">Crie um workspace primeiro para enviar e-mails de prospecção.</p>
          <Link
            href="/app"
            className="mt-2 flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:border-accent hover:text-accent"
          >
            Ir para workspaces
          </Link>
        </div>
      </div>
    )
  }

  if (workspaces) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight text-primary">Prospecção</h1>
        <p className="mb-8 text-sm text-muted-foreground">Escolha o workspace para enviar e-mails de prospecção.</p>

        <ul className="divide-y divide-border rounded-xl border border-border bg-background">
          {workspaces.map((w) => (
            <li key={w.id}>
              <Link
                href={`/app/workspace/${w.id}/emails`}
                className="flex items-center gap-3.5 px-5 py-4 transition-colors hover:bg-surface"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent"
                  aria-hidden="true"
                >
                  <Megaphone size={18} />
                </span>
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{w.name}</p>
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">Ver prospecção →</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl border border-border bg-surface" />
        ))}
      </div>
    </div>
  )
}
