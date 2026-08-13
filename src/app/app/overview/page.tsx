"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../../lib/supabaseClient'
import { useAppSession } from '../../../lib/AppSessionContext'
import { Avatar } from '../../../components/ui/Avatar'
import type { Card, CardPriority } from '../../../../supabase/types'

type Row = {
  card: Card
  boardId: string
  boardName: string
  columnName: string
}

const priorityLabel: Record<CardPriority, string> = { low: 'Baixa', medium: 'Média', high: 'Alta' }
const priorityColor: Record<CardPriority, string> = {
  low: 'text-muted-foreground',
  medium: 'text-warning',
  high: 'text-destructive',
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default function OverviewPage() {
  const { userId } = useAppSession()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [members, setMembers] = useState<Record<string, string>>({})
  const [scope, setScope] = useState<'mine' | 'all'>('mine')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (userId) fetchOverview(userId)
  }, [userId])

  async function fetchOverview(uid: string) {
    const { data: memberships, error: mErr } = await supabase.from('memberships').select('workspace_id').eq('user_id', uid)
    if (mErr) return setError(mErr.message)
    const workspaceIds = ((memberships ?? []) as { workspace_id: string }[]).map((m) => m.workspace_id)
    if (workspaceIds.length === 0) {
      setRows([])
      return
    }

    const { data: boards, error: bErr } = await supabase
      .from('boards')
      .select('id, name, workspace_id')
      .in('workspace_id', workspaceIds)
    if (bErr) return setError(bErr.message)
    const boardList = (boards ?? []) as { id: string; name: string; workspace_id: string }[]
    if (boardList.length === 0) {
      setRows([])
      return
    }
    const boardById = new Map(boardList.map((b) => [b.id, b]))

    const { data: columns, error: cErr } = await supabase
      .from('board_columns')
      .select('id, name, board_id')
      .in('board_id', boardList.map((b) => b.id))
    if (cErr) return setError(cErr.message)
    const columnList = (columns ?? []) as { id: string; name: string; board_id: string }[]
    if (columnList.length === 0) {
      setRows([])
      return
    }
    const columnById = new Map(columnList.map((c) => [c.id, c]))

    const { data: cards, error: cardErr } = await supabase
      .from('cards')
      .select('*')
      .in('column_id', columnList.map((c) => c.id))
      .order('position', { ascending: true })
    if (cardErr) return setError(cardErr.message)

    const builtRows: Row[] = ((cards ?? []) as Card[]).map((card) => {
      const col = columnById.get(card.column_id)
      const board = col ? boardById.get(col.board_id) : undefined
      return {
        card,
        boardId: board?.id ?? '',
        boardName: board?.name ?? '—',
        columnName: col?.name ?? '—',
      }
    })
    setRows(builtRows)

    const { data: memberships2 } = await supabase
      .from('memberships')
      .select('user_id')
      .in('workspace_id', workspaceIds)
    const memberIds = Array.from(new Set(((memberships2 ?? []) as { user_id: string }[]).map((m) => m.user_id)))
    if (memberIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, email').in('id', memberIds)
      const map: Record<string, string> = {}
      for (const p of (profiles ?? []) as { id: string; full_name: string | null; email: string }[]) {
        map[p.id] = p.full_name || p.email
      }
      setMembers(map)
    }
  }

  const visibleRows = (rows ?? []).filter(
    (r) => scope === 'all' || (userId && (r.card.metadata.assignee_ids ?? []).includes(userId))
  )

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-primary">Visão geral</h1>
        <p className="mt-1 text-sm text-muted-foreground">Todos os cards dos seus workspaces, num só lugar.</p>

        <div className="mt-6 inline-flex rounded-lg bg-background p-1 border border-border">
          <button
            onClick={() => setScope('mine')}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              scope === 'mine' ? 'bg-surface text-primary' : 'text-muted-foreground'
            }`}
          >
            Minhas tarefas
          </button>
          <button
            onClick={() => setScope('all')}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              scope === 'all' ? 'bg-surface text-primary' : 'text-muted-foreground'
            }`}
          >
            Todas as tarefas
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-6 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-6">
          {rows === null ? (
            <div className="flex flex-col gap-2" aria-label="Carregando visão geral">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg border border-border bg-background" />
              ))}
            </div>
          ) : visibleRows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-14 text-center">
              <p className="text-sm font-medium text-primary">
                {scope === 'mine' ? 'Nenhuma tarefa atribuída a você.' : 'Nenhum card ainda.'}
              </p>
              <p className="text-sm text-muted-foreground">
                {scope === 'mine'
                  ? 'Cards com você como responsável aparecem aqui.'
                  : 'Crie boards e cards para vê-los listados aqui.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-background">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Card</th>
                    <th className="px-4 py-3 font-medium">Board</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Prioridade</th>
                    <th className="px-4 py-3 font-medium">Prazo</th>
                    <th className="px-4 py-3 font-medium">Responsáveis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visibleRows.map(({ card, boardId, boardName, columnName }) => {
                    const priority = card.metadata.priority
                    const dueDate = card.metadata.due_date
                    const isOverdue = !!dueDate && dueDate < new Date().toISOString().slice(0, 10)
                    const assignees = (card.metadata.assignee_ids ?? []).map((id) => members[id]).filter(Boolean) as string[]
                    return (
                      <tr key={card.id} className="transition-colors hover:bg-surface">
                        <td className="px-4 py-3">
                          <Link href={`/app/board/${boardId}`} className="font-medium text-foreground hover:text-accent">
                            {card.title}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{boardName}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-surface px-2.5 py-1 text-xs text-foreground">{columnName}</span>
                        </td>
                        <td className="px-4 py-3">
                          {priority ? (
                            <span className={`text-xs font-medium ${priorityColor[priority]}`}>{priorityLabel[priority]}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className={`px-4 py-3 text-xs ${isOverdue ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
                          {dueDate ? formatDate(dueDate) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {assignees.length > 0 ? (
                            <span className="flex items-center -space-x-1.5">
                              {assignees.slice(0, 4).map((name, i) => (
                                <Avatar key={i} name={name} size={22} className="ring-2 ring-background" />
                              ))}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
    </div>
  )
}
