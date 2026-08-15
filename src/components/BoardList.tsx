"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, DotsThree, Kanban, MagnifyingGlass, Plus } from '@phosphor-icons/react/dist/ssr'
import { supabase } from '../lib/supabaseClient'
import { refreshSidebar } from '../lib/sidebarRefresh'
import { Field } from './ui/Field'
import { Button } from './ui/Button'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { Confetti } from './ui/Confetti'
import { useToast } from './ui/ToastProvider'
import { BOARD_COLORS, boardColorClasses, boardColorLabel } from './board/boardColors'
import type { BoardColor } from '../../supabase/types'

type BoardRow = {
  id: string
  name: string
  color: BoardColor
}

export default function BoardList({ workspaceId, userId }: { workspaceId: string; userId: string }) {
  const [boards, setBoards] = useState<BoardRow[] | null>(null)
  const [columnCounts, setColumnCounts] = useState<Record<string, number>>({})
  const [query, setQuery] = useState('')
  const [name, setName] = useState('')
  const [color, setColor] = useState<BoardColor>('accent')
  const [celebrate, setCelebrate] = useState(false)
  const [confettiActive, setConfettiActive] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<BoardRow | null>(null)
  const toast = useToast()

  useEffect(() => {
    fetchBoards()
  }, [workspaceId])

  async function fetchBoards() {
    const { data, error } = await supabase
      .from('boards')
      .select('id, name, color')
      .eq('workspace_id', workspaceId)
      .neq('kind', 'crm') // CRM has its own dedicated nav entry, not a generic board
      .order('created_at', { ascending: true })
    if (error) {
      setError(error.message)
      return
    }
    const boardList = (data ?? []) as BoardRow[]
    setBoards(boardList)

    const ids = boardList.map((b) => b.id)
    if (ids.length === 0) return
    const { data: columns } = await supabase.from('board_columns').select('board_id').in('board_id', ids)
    const counts: Record<string, number> = {}
    for (const c of (columns ?? []) as { board_id: string }[]) {
      counts[c.board_id] = (counts[c.board_id] ?? 0) + 1
    }
    setColumnCounts(counts)
  }

  async function createBoard(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    setError(null)
    const { error } = await supabase
      .from('boards')
      .insert({ workspace_id: workspaceId, name, color, created_by: userId })
    setCreating(false)
    if (error) return setError(error.message)
    setName('')
    setColor('accent')
    if (celebrate) setConfettiActive(true)
    fetchBoards()
    refreshSidebar()
  }

  function startRename(board: BoardRow) {
    setMenuOpenId(null)
    setEditingId(board.id)
    setEditingName(board.name)
  }

  async function commitRename(board: BoardRow) {
    setEditingId(null)
    const trimmed = editingName.trim()
    if (!trimmed || trimmed === board.name) return
    setBoards((prev) => (prev ? prev.map((b) => (b.id === board.id ? { ...b, name: trimmed } : b)) : prev))
    const { error } = await supabase.from('boards').update({ name: trimmed }).eq('id', board.id)
    if (error) setError(error.message)
    else refreshSidebar()
  }

  async function deleteBoard(id: string) {
    setMenuOpenId(null)
    setBoards((prev) => (prev ? prev.filter((b) => b.id !== id) : prev))
    const { error } = await supabase.from('boards').delete().eq('id', id)
    if (error) {
      setError(error.message)
      fetchBoards()
    } else {
      refreshSidebar()
    }
  }

  function requestDeleteBoard(id: string) {
    setMenuOpenId(null)
    const board = boards?.find((b) => b.id === id) ?? null
    setPendingDelete(board)
  }

  const filteredBoards = boards?.filter((b) => b.name.toLowerCase().includes(query.trim().toLowerCase())) ?? null

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end gap-3">
        <form onSubmit={createBoard} className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-64">
            <Field
              label="Novo board"
              name="board-name"
              placeholder="Ex.: Sprint atual"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">Cor</span>
            <div className="flex h-11 items-center gap-1.5">
              {BOARD_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  title={boardColorLabel(c)}
                  aria-label={boardColorLabel(c)}
                  aria-pressed={color === c}
                  className={`flex h-6 w-6 items-center justify-center rounded-full ${boardColorClasses(c).dot} transition-transform hover:scale-110 ${
                    color === c ? 'ring-2 ring-offset-2 ring-offset-background ring-primary/40' : ''
                  }`}
                >
                  {color === c && <Check size={12} weight="bold" className="text-white" />}
                </button>
              ))}
            </div>
          </div>

          <label className="mb-[1px] flex h-11 cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={celebrate}
              onChange={(e) => setCelebrate(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-accent"
            />
            🎉 Confete ao criar
          </label>

          <Button type="submit" disabled={creating || !name.trim()}>
            <Plus size={18} weight="bold" />
            Criar
          </Button>
        </form>

        {boards !== null && boards.length > 0 && (
          <div className="w-full sm:w-56">
            <Field
              label="Buscar board"
              name="board-search"
              placeholder="Nome do board…"
              icon={<MagnifyingGlass size={16} />}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {boards === null ? (
        <div className="flex flex-col gap-2" aria-label="Carregando boards">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg border border-border bg-surface" />
          ))}
        </div>
      ) : boards.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-14 text-center">
          <Kanban size={28} className="text-muted-foreground" />
          <p className="text-sm font-medium text-primary">Nenhum board ainda</p>
          <p className="text-sm text-muted-foreground">Crie o primeiro acima para começar a organizar cards.</p>
        </div>
      ) : filteredBoards !== null && filteredBoards.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-14 text-center">
          <MagnifyingGlass size={28} className="text-muted-foreground" />
          <p className="text-sm font-medium text-primary">Nenhum board encontrado</p>
          <p className="text-sm text-muted-foreground">Tente outro termo de busca.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(filteredBoards ?? []).map((b) => {
            const columns = columnCounts[b.id] ?? 0
            const isEditing = editingId === b.id
            return (
              <li key={b.id} className="group relative">
                {!isEditing && (
                  <div className="absolute right-2.5 top-2.5 z-10">
                    <button
                      onClick={() => setMenuOpenId((v) => (v === b.id ? null : b.id))}
                      aria-label="Opções do board"
                      className="rounded p-1 text-muted-foreground opacity-0 hover:bg-surface hover:text-foreground group-hover:opacity-100"
                    >
                      <DotsThree size={18} weight="bold" />
                    </button>
                    {menuOpenId === b.id && (
                      <div
                        className="absolute right-0 top-full mt-1 w-40 rounded-lg border border-border bg-background py-1 shadow-sm"
                        style={{ animation: 'dropdown-in 150ms ease-out' }}
                      >
                        <button
                          onClick={() => startRename(b)}
                          className="flex w-full items-center px-3 py-1.5 text-left text-sm text-foreground hover:bg-surface"
                        >
                          Renomear
                        </button>
                        <button
                          onClick={() => requestDeleteBoard(b.id)}
                          className="flex w-full items-center px-3 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10"
                        >
                          Excluir board
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {isEditing ? (
                  <div className="flex items-center gap-3.5 rounded-xl border border-accent bg-background p-5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                      <Kanban size={19} className="text-accent" />
                    </span>
                    <input
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={() => commitRename(b)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename(b)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-sm font-medium text-foreground outline-none"
                    />
                  </div>
                ) : (
                  <Link
                    href={`/app/board/${b.id}`}
                    className="flex items-center gap-3.5 rounded-xl border border-border bg-background p-5 transition-all hover:border-accent hover:shadow-sm"
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${boardColorClasses(b.color).icon}`}
                    >
                      <Kanban size={19} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate pr-5 text-sm font-medium text-foreground">{b.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {columns === 0 ? 'Sem colunas' : columns === 1 ? '1 coluna' : `${columns} colunas`}
                      </p>
                    </div>
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={`Excluir o board "${pendingDelete.name}"?`}
          description="Todas as colunas e cards desse board também serão excluídos. Essa ação não pode ser desfeita."
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            deleteBoard(pendingDelete.id)
            toast(`Board "${pendingDelete.name}" excluído.`)
            setPendingDelete(null)
          }}
        />
      )}

      {confettiActive && <Confetti onDone={() => setConfettiActive(false)} />}
    </div>
  )
}
