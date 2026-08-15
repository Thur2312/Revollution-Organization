"use client"
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { supabase } from '../../../../lib/supabaseClient'
import { useAppSession } from '../../../../lib/AppSessionContext'
import { boardColorClasses } from '../../../../components/board/boardColors'
import type { BoardColor } from '../../../../../supabase/types'

const KanbanBoard = dynamic(
  () => import('../../../../components/board/KanbanBoard').then((m) => m.KanbanBoard),
  { ssr: false }
)

export default function BoardPage({ params }: { params: { id: string } }) {
  const boardId = params.id
  const { userId } = useAppSession()
  const [board, setBoard] = useState<{
    name: string
    workspace_id: string
    color: BoardColor
    workspace: { name: string } | null
  } | null>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('boards')
        .select('name, workspace_id, color, workspace:workspaces(name)')
        .eq('id', boardId)
        .single()
      setBoard(
        (data as unknown as {
          name: string
          workspace_id: string
          color: BoardColor
          workspace: { name: string } | null
        }) ?? null
      )
    }
    load()
  }, [boardId])

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      {board?.workspace?.name && (
        <p className="mb-1 text-sm text-muted-foreground">
          <Link href={`/app/workspace/${board.workspace_id}`} className="hover:text-primary">
            {board.workspace.name}
          </Link>{' '}
          /
        </p>
      )}
      <h1 className="mb-8 flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-primary">
        {board && <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${boardColorClasses(board.color).dot}`} />}
        {board?.name ?? ' '}
      </h1>

      {userId && board ? (
        <KanbanBoard boardId={boardId} workspaceId={board.workspace_id} userId={userId} boardName={board.name} />
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
