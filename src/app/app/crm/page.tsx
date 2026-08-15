"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { SquaresFour } from '@phosphor-icons/react/dist/ssr'
import { supabase } from '../../../lib/supabaseClient'
import { useAppSession } from '../../../lib/AppSessionContext'

export default function CrmLandingPage() {
  const { userId } = useAppSession()
  const router = useRouter()
  const [hasNoWorkspace, setHasNoWorkspace] = useState(false)

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
      const { data: ws } = await supabase.from('workspaces').select('id').in('id', ids).order('name').limit(1)
      const first = (ws ?? [])[0] as { id: string } | undefined
      if (!mounted) return
      if (first) router.replace(`/app/workspace/${first.id}/crm`)
      else setHasNoWorkspace(true)
    }
    load()
    return () => {
      mounted = false
    }
  }, [userId, router])

  if (!hasNoWorkspace) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-64 w-72 shrink-0 animate-pulse rounded-xl border border-border bg-surface" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-primary">CRM</h1>
      <p className="mb-8 text-sm text-muted-foreground">Funil de vendas — prospecção até pós-venda.</p>

      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-14 text-center">
        <SquaresFour size={28} className="text-muted-foreground" />
        <p className="text-sm font-medium text-primary">Você ainda não tem um workspace</p>
        <p className="text-sm text-muted-foreground">Crie um workspace primeiro para começar a usar o CRM.</p>
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
