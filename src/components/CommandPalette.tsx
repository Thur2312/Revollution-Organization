"use client"
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Kanban, MagnifyingGlass, SquaresFour } from '@phosphor-icons/react/dist/ssr'
import { supabase } from '../lib/supabaseClient'

type WorkspaceResult = { type: 'workspace'; id: string; label: string }
type BoardResult = { type: 'board'; id: string; label: string; sublabel: string }
type CardResult = { type: 'card'; id: string; boardId: string; label: string; sublabel: string }
type Result = WorkspaceResult | BoardResult | CardResult

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setResults([])
      return
    }
    setLoading(true)
    const handle = setTimeout(async () => {
      const like = `%${trimmed}%`
      const [wsRes, boardRes, cardRes] = await Promise.all([
        supabase.from('workspaces').select('id, name').ilike('name', like).limit(5),
        supabase.from('boards').select('id, name, workspace:workspaces(name)').ilike('name', like).limit(5),
        supabase
          .from('cards')
          .select('id, title, column_id, board_columns(board_id, boards(id, name))')
          .ilike('title', like)
          .limit(6),
      ])

      const workspaceResults: Result[] = ((wsRes.data ?? []) as { id: string; name: string }[]).map((w) => ({
        type: 'workspace',
        id: w.id,
        label: w.name,
      }))

      const boardResults: Result[] = (
        (boardRes.data ?? []) as { id: string; name: string; workspace: { name: string } | null }[]
      ).map((b) => ({
        type: 'board',
        id: b.id,
        label: b.name,
        sublabel: b.workspace?.name ?? '',
      }))

      type CardRow = {
        id: string
        title: string
        board_columns: { board_id: string; boards: { id: string; name: string } | null } | null
      }
      const cardResults: Result[] = ((cardRes.data ?? []) as unknown as CardRow[])
        .filter((c) => c.board_columns?.boards)
        .map((c) => ({
          type: 'card',
          id: c.id,
          boardId: c.board_columns!.boards!.id,
          label: c.title,
          sublabel: c.board_columns!.boards!.name,
        }))

      setResults([...workspaceResults, ...boardResults, ...cardResults])
      setLoading(false)
    }, 250)
    return () => clearTimeout(handle)
  }, [query])

  function go(result: Result) {
    onClose()
    if (result.type === 'workspace') router.push(`/app/workspace/${result.id}`)
    else if (result.type === 'board') router.push(`/app/board/${result.id}`)
    else router.push(`/app/board/${result.boardId}?openCard=${result.id}`)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-wine/40 px-4 pt-[12vh] backdrop-blur-sm"
      style={{ animation: 'backdrop-in 150ms ease-out' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-background shadow-xl"
        style={{ animation: 'modal-in 220ms cubic-bezier(0.16,1,0.3,1)' }}
      >
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
          <MagnifyingGlass size={18} className="text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar workspaces, boards e cards…"
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">Esc</kbd>
        </div>

        <div className="max-h-96 overflow-y-auto py-1.5">
          {loading && <p className="px-4 py-6 text-center text-sm text-muted-foreground">Buscando…</p>}
          {!loading && query.trim().length >= 2 && results.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nada encontrado.</p>
          )}
          {!loading && query.trim().length < 2 && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Digite ao menos 2 caracteres…</p>
          )}
          {results.map((r) => (
            <button
              key={`${r.type}-${r.id}`}
              onClick={() => go(r)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                {r.type === 'workspace' ? (
                  <SquaresFour size={16} />
                ) : r.type === 'board' ? (
                  <Kanban size={16} />
                ) : (
                  <MagnifyingGlass size={16} />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{r.label}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {r.type === 'workspace' ? 'Workspace' : r.type === 'board' ? `Board · ${r.sublabel}` : `Card · ${r.sublabel}`}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
