"use client"
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CheckCircle, Circle } from '@phosphor-icons/react/dist/ssr'
import { supabase } from '../../../lib/supabaseClient'
import { useAppSession } from '../../../lib/AppSessionContext'

type BoardRow = { id: string; name: string; workspace_id: string }
type ColumnRow = { id: string; board_id: string; name: string; position: number }
type CardRow = { id: string; title: string; column_id: string; metadata: { due_date?: string } | null }
type WorkspaceRow = { id: string; name: string }

type TaskRow = {
  cardId: string
  title: string
  columnName: string
  done: boolean
  dueDate: string | null
  workspaceName: string
  boardName: string
}

export default function DashboardPage() {
  const { loading, isPlatformAdmin } = useAppSession()
  const [rows, setRows] = useState<TaskRow[] | null>(null)
  const [filter, setFilter] = useState<'open' | 'done' | 'all'>('open')

  useEffect(() => {
    if (!isPlatformAdmin) return
    let mounted = true

    async function load() {
      const { data: boards } = await supabase.from('boards').select('id, name, workspace_id').eq('kind', 'kanban')
      const boardList = (boards ?? []) as BoardRow[]
      if (boardList.length === 0) {
        if (mounted) setRows([])
        return
      }

      const workspaceIds = Array.from(new Set(boardList.map((b) => b.workspace_id)))
      const [{ data: workspaces }, { data: columns }] = await Promise.all([
        supabase.from('workspaces').select('id, name').in('id', workspaceIds),
        supabase
          .from('board_columns')
          .select('id, board_id, name, position')
          .in('board_id', boardList.map((b) => b.id)),
      ])
      const columnList = (columns ?? []) as ColumnRow[]
      if (columnList.length === 0) {
        if (mounted) setRows([])
        return
      }

      const { data: cards } = await supabase
        .from('cards')
        .select('id, title, column_id, metadata')
        .in('column_id', columnList.map((c) => c.id))

      const workspaceName = new Map(((workspaces ?? []) as WorkspaceRow[]).map((w) => [w.id, w.name]))
      const boardById = new Map(boardList.map((b) => [b.id, b]))
      const columnById = new Map(columnList.map((c) => [c.id, c]))
      const maxPositionByBoard = new Map<string, number>()
      for (const c of columnList) {
        maxPositionByBoard.set(c.board_id, Math.max(maxPositionByBoard.get(c.board_id) ?? 0, c.position))
      }

      const nextRows: TaskRow[] = ((cards ?? []) as CardRow[]).map((card) => {
        const column = columnById.get(card.column_id)!
        const board = boardById.get(column.board_id)!
        return {
          cardId: card.id,
          title: card.title,
          columnName: column.name,
          done: column.position === maxPositionByBoard.get(column.board_id),
          dueDate: card.metadata?.due_date ?? null,
          workspaceName: workspaceName.get(board.workspace_id) ?? '—',
          boardName: board.name,
        }
      })
      if (mounted) setRows(nextRows)
    }
    load()
    return () => {
      mounted = false
    }
  }, [isPlatformAdmin])

  const counts = useMemo(() => {
    if (!rows) return { open: 0, done: 0 }
    return { open: rows.filter((r) => !r.done).length, done: rows.filter((r) => r.done).length }
  }, [rows])

  const filtered = useMemo(() => {
    if (!rows) return null
    if (filter === 'all') return rows
    return rows.filter((r) => (filter === 'done' ? r.done : !r.done))
  }, [rows, filter])

  if (loading) return null

  if (!isPlatformAdmin) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-sm text-muted-foreground">Você não tem acesso a essa página.</p>
        <Link href="/app" className="mt-2 inline-block text-sm text-accent hover:underline">
          Voltar
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-primary">Dashboard de tarefas</h1>
      <p className="mb-6 text-sm text-muted-foreground">Cards de todos os workspaces, feitos ou em aberto.</p>

      <div className="mb-4 flex items-center gap-2">
        {(['open', 'done', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              filter === f
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {f === 'open' ? `Em aberto (${counts.open})` : f === 'done' ? `Feitas (${counts.done})` : 'Todas'}
          </button>
        ))}
      </div>

      {filtered === null ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-11 animate-pulse rounded-lg bg-surface" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma tarefa aqui.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Tarefa</th>
                <th className="px-4 py-2 font-medium">Coluna</th>
                <th className="px-4 py-2 font-medium">Board</th>
                <th className="px-4 py-2 font-medium">Workspace</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((r) => (
                <tr key={r.cardId} className="hover:bg-surface/50">
                  <td className="px-4 py-2.5">
                    {r.done ? (
                      <CheckCircle size={16} weight="fill" className="text-emerald-500" />
                    ) : (
                      <Circle size={16} className="text-muted-foreground" />
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-foreground">{r.title}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.columnName}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.boardName}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.workspaceName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
