"use client"
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { supabase } from '../../../../../lib/supabaseClient'
import { useAppSession } from '../../../../../lib/AppSessionContext'
import { ensureCrmBoard } from '../../../../../lib/crm'
import type { Board } from '../../../../../../supabase/types'

const KanbanBoard = dynamic(
  () => import('../../../../../components/board/KanbanBoard').then((m) => m.KanbanBoard),
  { ssr: false }
)

export default function WorkspaceCrmPage({ params }: { params: { id: string } }) {
  const workspaceId = params.id
  const { userId } = useAppSession()
  const [workspaceName, setWorkspaceName] = useState<string | null>(null)
  const [board, setBoard] = useState<Board | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('workspaces').select('name').eq('id', workspaceId).single()
      setWorkspaceName((data as { name: string } | null)?.name ?? null)
    }
    load()
  }, [workspaceId])

  useEffect(() => {
    if (!userId) return
    let mounted = true
    ensureCrmBoard(workspaceId, userId)
      .then((b) => mounted && setBoard(b))
      .catch((e) => mounted && setError(e.message))
    return () => {
      mounted = false
    }
  }, [workspaceId, userId])

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      {workspaceName && (
        <p className="mb-1 text-sm text-muted-foreground">
          <Link href={`/app/workspace/${workspaceId}`} className="hover:text-primary">
            {workspaceName}
          </Link>{' '}
          /
        </p>
      )}
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-primary">CRM</h1>
      <p className="mb-8 text-sm text-muted-foreground">Funil de vendas — prospecção até pós-venda.</p>

      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {userId && board ? (
        <KanbanBoard boardId={board.id} workspaceId={workspaceId} userId={userId} boardName="CRM" crm />
      ) : (
        <div className="flex gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-64 w-72 shrink-0 animate-pulse rounded-xl border border-border bg-surface" />
          ))}
        </div>
      )}
    </div>
  )
}
