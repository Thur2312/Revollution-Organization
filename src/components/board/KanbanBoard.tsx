"use client"
import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { DownloadSimple, MagnifyingGlass, Plus, SquaresFour, Trash, UploadSimple, X } from '@phosphor-icons/react/dist/ssr'
import { supabase } from '../../lib/supabaseClient'
import type { BoardColor, BoardColumn as BoardColumnType, Card, CardPriority } from '../../../supabase/types'
import { BoardColumn } from './BoardColumn'
import { CardModal } from './CardModal'
import { Field } from '../ui/Field'
import { Select } from '../ui/Select'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Confetti } from '../ui/Confetti'
import { useToast } from '../ui/ToastProvider'
import { toCsv, downloadCsv } from '../../lib/csv'
import { ImportSpreadsheetModal } from '../crm/ImportSpreadsheetModal'

const priorityLabel: Record<CardPriority, string> = { low: 'Baixa', medium: 'Média', high: 'Alta' }

export type CardMeta = {
  checklistDone: number
  checklistTotal: number
  comments: number
  attachments: number
}

const emptyMeta: CardMeta = { checklistDone: 0, checklistTotal: 0, comments: 0, attachments: 0 }

export function KanbanBoard({
  boardId,
  workspaceId,
  userId,
  boardName,
  crm = false,
}: {
  boardId: string
  workspaceId: string
  userId: string
  boardName: string
  crm?: boolean
}) {
  const [columns, setColumns] = useState<BoardColumnType[]>([])
  const [cardsByColumn, setCardsByColumn] = useState<Record<string, Card[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addingColumn, setAddingColumn] = useState(false)
  const [columnName, setColumnName] = useState('')
  const [confettiActive, setConfettiActive] = useState(false)
  const [activeCard, setActiveCard] = useState<Card | null>(null)
  const [activeColumn, setActiveColumn] = useState<BoardColumnType | null>(null)
  const [openCard, setOpenCard] = useState<Card | null>(null)
  const [cardMeta, setCardMeta] = useState<Record<string, CardMeta>>({})
  const [members, setMembers] = useState<Record<string, string>>({})
  const [memberAvatars, setMemberAvatars] = useState<Record<string, string | null>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [filterAssignee, setFilterAssignee] = useState('')
  const [filterPriority, setFilterPriority] = useState<CardPriority | ''>('')
  const [pendingColumnDelete, setPendingColumnDelete] = useState<BoardColumnType | null>(null)
  const [pendingCardDelete, setPendingCardDelete] = useState<Card | null>(null)
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [importingSheet, setImportingSheet] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  function toggleCardSelection(id: string) {
    setSelectedCardIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function clearSelection() {
    setSelectedCardIds(new Set())
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    fetchMembers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId])

  // Deep link from the command palette (?openCard=<id>) — once the board's
  // cards are loaded, open that card's modal and strip the param so a later
  // manual close doesn't get immediately reopened by a stale URL.
  useEffect(() => {
    if (loading) return
    const cardId = searchParams.get('openCard')
    if (!cardId) return
    for (const list of Object.values(cardsByColumn)) {
      const card = list.find((c) => c.id === cardId)
      if (card) {
        setOpenCard(card)
        break
      }
    }
    router.replace(`/app/board/${boardId}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  // Live sync: other people's column/card writes land here via Realtime.
  // Reconciliation is upsert-by-id, so it's safe (a no-op) when the event is
  // just an echo of this tab's own optimistic update landing back.
  const columnsRef = useRef<BoardColumnType[]>([])
  useEffect(() => {
    columnsRef.current = columns
  }, [columns])

  useEffect(() => {
    const channel = supabase
      .channel(`board:${boardId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'board_columns', filter: `board_id=eq.${boardId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: string }).id
            setColumns((prev) => prev.filter((c) => c.id !== deletedId))
            setCardsByColumn((prev) => {
              const next = { ...prev }
              delete next[deletedId]
              return next
            })
            return
          }
          const row = payload.new as BoardColumnType
          setColumns((prev) => {
            const next = prev.some((c) => c.id === row.id) ? prev.map((c) => (c.id === row.id ? row : c)) : [...prev, row]
            return [...next].sort((a, b) => a.position - b.position)
          })
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cards' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: string }).id
            setCardsByColumn((prev) => {
              const next: Record<string, Card[]> = {}
              for (const colId of Object.keys(prev)) next[colId] = prev[colId].filter((c) => c.id !== deletedId)
              return next
            })
            return
          }
          const row = payload.new as Card
          if (!columnsRef.current.some((c) => c.id === row.column_id)) return // not this board
          setCardsByColumn((prev) => {
            const next: Record<string, Card[]> = {}
            for (const colId of Object.keys(prev)) next[colId] = prev[colId].filter((c) => c.id !== row.id)
            const destList = [...(next[row.column_id] ?? []), row].sort((a, b) => a.position - b.position)
            next[row.column_id] = destList
            return next
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [boardId])

  async function fetchMembers() {
    const { data: memberships } = await supabase.from('memberships').select('user_id').eq('workspace_id', workspaceId)
    const ids = ((memberships ?? []) as { user_id: string }[]).map((m) => m.user_id)
    if (ids.length === 0) return
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, email, avatar_url').in('id', ids)
    const map: Record<string, string> = {}
    const avatarMap: Record<string, string | null> = {}
    for (const p of (profiles ?? []) as { id: string; full_name: string | null; email: string; avatar_url: string | null }[]) {
      map[p.id] = p.full_name || p.email
      avatarMap[p.id] = p.avatar_url
    }
    setMembers(map)
    setMemberAvatars(avatarMap)
  }

  useEffect(() => {
    fetchAll()
  }, [boardId])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== '/') return
      const target = e.target as HTMLElement
      const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable
      if (isTyping || openCard) return
      e.preventDefault()
      searchInputRef.current?.focus()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [openCard])

  async function fetchAll() {
    setLoading(true)
    const { data: cols, error: colErr } = await supabase
      .from('board_columns')
      .select('*')
      .eq('board_id', boardId)
      .order('position', { ascending: true })
    if (colErr) {
      setError(colErr.message)
      setLoading(false)
      return
    }
    const columnList = (cols ?? []) as BoardColumnType[]
    setColumns(columnList)

    if (columnList.length === 0) {
      setCardsByColumn({})
      setLoading(false)
      return
    }

    const { data: cards, error: cardErr } = await supabase
      .from('cards')
      .select('*')
      .in('column_id', columnList.map((c) => c.id))
      .order('position', { ascending: true })
    if (cardErr) {
      setError(cardErr.message)
      setLoading(false)
      return
    }

    const cardList = (cards ?? []) as Card[]
    const grouped: Record<string, Card[]> = {}
    for (const col of columnList) grouped[col.id] = []
    for (const card of cardList) grouped[card.column_id]?.push(card)
    setCardsByColumn(grouped)
    setLoading(false)
    fetchCardMeta(cardList.map((c) => c.id))
  }

  async function fetchCardMeta(cardIds: string[]) {
    if (cardIds.length === 0) return
    const [checklistsRes, commentsRes, attachmentsRes] = await Promise.all([
      supabase.from('checklists').select('id, card_id').in('card_id', cardIds),
      supabase.from('comments').select('card_id').in('card_id', cardIds),
      supabase.from('attachments').select('card_id').in('card_id', cardIds),
    ])

    const checklists = (checklistsRes.data ?? []) as { id: string; card_id: string }[]
    const checklistIds = checklists.map((c) => c.id)
    const { data: itemsData } = checklistIds.length
      ? await supabase.from('checklist_items').select('checklist_id, done').in('checklist_id', checklistIds)
      : { data: [] as { checklist_id: string; done: boolean }[] }
    const items = (itemsData ?? []) as { checklist_id: string; done: boolean }[]
    const comments = (commentsRes.data ?? []) as { card_id: string }[]
    const attachments = (attachmentsRes.data ?? []) as { card_id: string }[]

    const checklistToCard = new Map<string, string>(checklists.map((c) => [c.id, c.card_id]))
    const next: Record<string, CardMeta> = {}
    for (const id of cardIds) next[id] = { ...emptyMeta }

    for (const item of items) {
      const cardId = checklistToCard.get(item.checklist_id)
      if (!cardId || !next[cardId]) continue
      next[cardId].checklistTotal += 1
      if (item.done) next[cardId].checklistDone += 1
    }
    for (const c of comments) {
      if (next[c.card_id]) next[c.card_id].comments += 1
    }
    for (const a of attachments) {
      if (next[a.card_id]) next[a.card_id].attachments += 1
    }

    setCardMeta((prev) => ({ ...prev, ...next }))
  }

  async function createColumn(e: React.FormEvent) {
    e.preventDefault()
    if (!columnName.trim()) return
    const { error } = await supabase
      .from('board_columns')
      .insert({ board_id: boardId, name: columnName.trim(), position: columns.length })
    if (error) return setError(error.message)
    setColumnName('')
    setAddingColumn(false)
    fetchAll()
  }

  function celebrateIfEnabled(columnId: string) {
    if (columns.find((c) => c.id === columnId)?.celebrate_on_card) setConfettiActive(true)
  }

  async function toggleColumnCelebrate(columnId: string, next: boolean) {
    setColumns((prev) => prev.map((c) => (c.id === columnId ? { ...c, celebrate_on_card: next } : c)))
    const { error } = await supabase.from('board_columns').update({ celebrate_on_card: next }).eq('id', columnId)
    if (error) setError(error.message)
  }

  async function changeColumnColor(columnId: string, color: BoardColor | null) {
    setColumns((prev) => prev.map((c) => (c.id === columnId ? { ...c, color } : c)))
    const { error } = await supabase.from('board_columns').update({ color }).eq('id', columnId)
    if (error) setError(error.message)
  }

  async function renameColumn(id: string, name: string) {
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)))
    const { error } = await supabase.from('board_columns').update({ name }).eq('id', id)
    if (error) setError(error.message)
  }

  async function deleteColumn(id: string) {
    setColumns((prev) => prev.filter((c) => c.id !== id))
    setCardsByColumn((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    const { error } = await supabase.from('board_columns').delete().eq('id', id)
    if (error) {
      setError(error.message)
      fetchAll()
    }
  }

  function requestDeleteColumn(id: string) {
    const column = columns.find((c) => c.id === id)
    if (column) setPendingColumnDelete(column)
  }

  async function addCard(columnId: string, title: string) {
    const position = cardsByColumn[columnId]?.length ?? 0
    const { data, error } = await supabase
      .from('cards')
      .insert({ column_id: columnId, title, position, created_by: userId })
      .select()
      .single()
    if (error) return setError(error.message)
    setCardsByColumn((prev) => ({ ...prev, [columnId]: [...(prev[columnId] ?? []), data as Card] }))
    celebrateIfEnabled(columnId)
  }

  async function duplicateCard(source: Card) {
    const position = cardsByColumn[source.column_id]?.length ?? 0
    const { data, error } = await supabase
      .from('cards')
      .insert({
        column_id: source.column_id,
        title: `${source.title} (cópia)`,
        description: source.description,
        metadata: source.metadata,
        position,
        created_by: userId,
      })
      .select()
      .single()
    if (error) return setError(error.message)
    const created = data as Card
    setCardsByColumn((prev) => ({ ...prev, [source.column_id]: [...(prev[source.column_id] ?? []), created] }))
    setOpenCard(null)
    toast('Card duplicado.')
  }

  async function deleteCard(id: string) {
    const columnId = Object.keys(cardsByColumn).find((colId) =>
      cardsByColumn[colId].some((c) => c.id === id)
    )
    setCardsByColumn((prev) => {
      if (!columnId) return prev
      return { ...prev, [columnId]: prev[columnId].filter((c) => c.id !== id) }
    })
    const { error } = await supabase.from('cards').delete().eq('id', id)
    if (error) {
      setError(error.message)
      fetchAll()
    }
  }

  function requestDeleteCard(id: string) {
    for (const list of Object.values(cardsByColumn)) {
      const card = list.find((c) => c.id === id)
      if (card) {
        setPendingCardDelete(card)
        return
      }
    }
  }

  async function bulkMoveTo(destColumnId: string) {
    const ids = Array.from(selectedCardIds)
    if (ids.length === 0) return

    let nextCardsByColumn = cardsByColumn
    setCardsByColumn((prev) => {
      const next: Record<string, Card[]> = {}
      for (const colId of Object.keys(prev)) next[colId] = [...prev[colId]]

      const moved: Card[] = []
      for (const colId of Object.keys(next)) {
        const staying: Card[] = []
        for (const card of next[colId]) {
          if (ids.includes(card.id) && colId !== destColumnId) moved.push({ ...card, column_id: destColumnId })
          else staying.push(card)
        }
        next[colId] = staying
      }
      next[destColumnId] = [...(next[destColumnId] ?? []), ...moved]
      nextCardsByColumn = next
      return next
    })
    clearSelection()
    celebrateIfEnabled(destColumnId)
    const destColumnName = columns.find((c) => c.id === destColumnId)?.name ?? ''
    toast(`${ids.length} ${ids.length === 1 ? 'card movido' : 'cards movidos'} para "${destColumnName}".`)

    const destList = nextCardsByColumn[destColumnId] ?? []
    await Promise.all(
      destList.map((c, i) =>
        supabase.from('cards').update({ column_id: destColumnId, position: i }).eq('id', c.id)
      )
    )
  }

  function requestBulkDelete() {
    setBulkDeleting(true)
  }

  async function confirmBulkDelete() {
    const ids = Array.from(selectedCardIds)
    setBulkDeleting(false)
    clearSelection()
    setCardsByColumn((prev) => {
      const next: Record<string, Card[]> = {}
      for (const colId of Object.keys(prev)) next[colId] = prev[colId].filter((c) => !ids.includes(c.id))
      return next
    })
    const { error } = await supabase.from('cards').delete().in('id', ids)
    if (error) {
      setError(error.message)
      fetchAll()
    } else {
      toast(`${ids.length} ${ids.length === 1 ? 'card excluído' : 'cards excluídos'}.`)
    }
  }

  function handleCardUpdated(updated: Card) {
    setCardsByColumn((prev) => ({
      ...prev,
      [updated.column_id]: (prev[updated.column_id] ?? []).map((c) => (c.id === updated.id ? updated : c)),
    }))
    setOpenCard((prev) => (prev && prev.id === updated.id ? updated : prev))
  }

  function findColumnId(cardId: string): string | undefined {
    return Object.keys(cardsByColumn).find((colId) => cardsByColumn[colId].some((c) => c.id === cardId))
  }

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id)
    if (event.active.data.current?.type === 'column') {
      const columnId = id.replace('col-sort:', '')
      setActiveColumn(columns.find((c) => c.id === columnId) ?? null)
      return
    }
    const colId = findColumnId(id)
    if (colId) setActiveCard(cardsByColumn[colId].find((c) => c.id === id) ?? null)
  }

  async function syncPositions(colId: string, list: Card[]) {
    await Promise.all(list.map((c, i) => supabase.from('cards').update({ position: i }).eq('id', c.id)))
  }

  async function syncColumnPositions(list: BoardColumnType[]) {
    await Promise.all(list.map((c, i) => supabase.from('board_columns').update({ position: i }).eq('id', c.id)))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (active.data.current?.type === 'column') {
      setActiveColumn(null)
      if (!over || over.id === active.id) return
      const activeColId = String(active.id).replace('col-sort:', '')
      const overColId = String(over.id).replace('col-sort:', '')
      const oldIndex = columns.findIndex((c) => c.id === activeColId)
      const newIndex = columns.findIndex((c) => c.id === overColId)
      if (oldIndex === -1 || newIndex === -1) return
      const reordered = arrayMove(columns, oldIndex, newIndex)
      setColumns(reordered)
      syncColumnPositions(reordered)
      return
    }

    setActiveCard(null)
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)
    const sourceColId = findColumnId(activeId)
    if (!sourceColId) return

    const overIsColumn = columns.some((c) => c.id === overId)
    const destColId = overIsColumn ? overId : findColumnId(overId)
    if (!destColId) return

    if (sourceColId === destColId) {
      const list = cardsByColumn[sourceColId]
      const activeIndex = list.findIndex((c) => c.id === activeId)
      const overIndex = overIsColumn ? list.length - 1 : list.findIndex((c) => c.id === overId)
      if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) return
      const reordered = arrayMove(list, activeIndex, overIndex)
      setCardsByColumn((prev) => ({ ...prev, [sourceColId]: reordered }))
      syncPositions(sourceColId, reordered)
      return
    }

    const sourceList = [...cardsByColumn[sourceColId]]
    const activeIndex = sourceList.findIndex((c) => c.id === activeId)
    if (activeIndex === -1) return
    const [moved] = sourceList.splice(activeIndex, 1)

    const destList = [...(cardsByColumn[destColId] ?? [])]
    const overIndex = overIsColumn ? destList.length : destList.findIndex((c) => c.id === overId)
    const insertAt = overIndex === -1 ? destList.length : overIndex
    destList.splice(insertAt, 0, { ...moved, column_id: destColId })

    setCardsByColumn((prev) => ({ ...prev, [sourceColId]: sourceList, [destColId]: destList }))
    celebrateIfEnabled(destColId)

    supabase
      .from('cards')
      .update({ column_id: destColId })
      .eq('id', moved.id)
      .then(() => Promise.all([syncPositions(sourceColId, sourceList), syncPositions(destColId, destList)]))
      .catch(() => fetchAll())
  }

  if (loading) {
    return (
      <div className="flex gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-64 w-72 shrink-0 animate-pulse rounded-xl border border-border bg-surface" />
        ))}
      </div>
    )
  }

  const hasActiveFilter = searchQuery.trim() !== '' || filterAssignee !== '' || filterPriority !== ''
  const q = searchQuery.trim().toLowerCase()
  const visibleCardsByColumn: Record<string, Card[]> = {}
  for (const col of columns) {
    visibleCardsByColumn[col.id] = (cardsByColumn[col.id] ?? []).filter((card) => {
      if (q && !card.title.toLowerCase().includes(q) && !(card.description ?? '').toLowerCase().includes(q)) {
        return false
      }
      if (filterAssignee && !(card.metadata?.assignee_ids ?? []).includes(filterAssignee)) return false
      if (filterPriority && card.metadata?.priority !== filterPriority) return false
      return true
    })
  }
  const visibleCount = Object.values(visibleCardsByColumn).reduce((sum, list) => sum + list.length, 0)
  const totalCount = Object.values(cardsByColumn).reduce((sum, list) => sum + list.length, 0)

  function exportCsv() {
    const rows: string[][] = []
    for (const col of columns) {
      for (const card of visibleCardsByColumn[col.id] ?? []) {
        const assignees = (card.metadata?.assignee_ids ?? []).map((id) => members[id] ?? id).join('; ')
        rows.push([
          col.name,
          card.title,
          card.description ?? '',
          card.metadata?.priority ? priorityLabel[card.metadata.priority] : '',
          card.metadata?.due_date ?? '',
          assignees,
          (card.metadata?.labels ?? []).join('; '),
        ])
      }
    }
    const csv = toCsv(['Coluna', 'Título', 'Descrição', 'Prioridade', 'Vencimento', 'Responsáveis', 'Labels'], rows)
    downloadCsv(`${boardName || 'board'}.csv`, csv)
    toast('CSV exportado.')
  }

  return (
    <div>
      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {(totalCount > 0 || hasActiveFilter || crm) && (
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-56">
            <Field
              ref={searchInputRef}
              label="Buscar card"
              name="card-search"
              placeholder="Título ou descrição… (atalho: /)"
              icon={<MagnifyingGlass size={16} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select label="Responsável" value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(members).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </Select>
          <Select
            label="Prioridade"
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value as CardPriority | '')}
          >
            <option value="">Todas</option>
            {(Object.entries(priorityLabel) as [CardPriority, string][]).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          {hasActiveFilter && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setFilterAssignee('')
                setFilterPriority('')
              }}
              className="flex h-11 items-center gap-1 rounded-lg px-3 text-sm text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
              Limpar filtros
            </button>
          )}
          {hasActiveFilter && (
            <p className="text-sm text-muted-foreground">
              {visibleCount} de {totalCount} cards
            </p>
          )}
          {crm && (
            <button
              type="button"
              onClick={() => setImportingSheet(true)}
              title="Importa clientes de uma planilha .xlsx/.csv"
              className="ml-auto flex h-11 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-foreground hover:border-accent hover:text-accent"
            >
              <UploadSimple size={16} />
              Importar planilha
            </button>
          )}
          {totalCount > 0 && (
            <button
              type="button"
              onClick={exportCsv}
              title={hasActiveFilter ? 'Exporta os cards filtrados' : 'Exporta todos os cards do board'}
              className={`flex h-11 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-foreground hover:border-accent hover:text-accent ${
                crm ? '' : 'ml-auto'
              }`}
            >
              <DownloadSimple size={16} />
              Exportar CSV
            </button>
          )}
        </div>
      )}

      {selectedCardIds.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-accent/30 bg-accent/5 px-4 py-2.5">
          <p className="text-sm font-medium text-foreground">
            {selectedCardIds.size} {selectedCardIds.size === 1 ? 'card selecionado' : 'cards selecionados'}
          </p>
          <Select
            size="sm"
            className="w-auto"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) bulkMoveTo(e.target.value)
            }}
          >
            <option value="" disabled>
              Mover para…
            </option>
            {columns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <button
            type="button"
            onClick={requestBulkDelete}
            className="flex items-center gap-1.5 text-sm text-destructive hover:underline"
          >
            <Trash size={14} />
            Excluir selecionados
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="ml-auto text-sm text-muted-foreground hover:text-foreground"
          >
            Cancelar seleção
          </button>
        </div>
      )}

      {columns.length === 0 && !addingColumn && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-14 text-center">
          <SquaresFour size={28} className="text-muted-foreground" />
          <p className="text-sm font-medium text-primary">Este board ainda não tem colunas</p>
          <p className="text-sm text-muted-foreground">Crie a primeira para começar a organizar cards.</p>
          <button
            onClick={() => setAddingColumn(true)}
            className="mt-2 flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:border-accent hover:text-accent"
          >
            <Plus size={16} />
            Criar coluna
          </button>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className={`flex items-start gap-4 overflow-x-auto pb-4 ${columns.length === 0 && !addingColumn ? 'hidden' : ''}`}>
          <SortableContext items={columns.map((c) => `col-sort:${c.id}`)} strategy={horizontalListSortingStrategy}>
            {columns.map((column) => (
              <BoardColumn
                key={column.id}
                column={column}
                cards={visibleCardsByColumn[column.id] ?? []}
                cardMeta={cardMeta}
                members={members}
                memberAvatars={memberAvatars}
                selectedCardIds={selectedCardIds}
                crm={crm}
                onToggleSelect={toggleCardSelection}
                onRename={renameColumn}
                onDelete={requestDeleteColumn}
                onToggleCelebrate={toggleColumnCelebrate}
                onChangeColor={changeColumnColor}
                onAddCard={addCard}
                onDeleteCard={requestDeleteCard}
                onOpenCard={setOpenCard}
              />
            ))}
          </SortableContext>

          <div className="w-72 shrink-0">
            {addingColumn ? (
              <form
                onSubmit={createColumn}
                className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-2.5"
              >
                <input
                  autoFocus
                  value={columnName}
                  onChange={(e) => setColumnName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Escape' && setAddingColumn(false)}
                  placeholder="Nome da coluna"
                  className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground hover:bg-accent/90"
                  >
                    Adicionar
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddingColumn(false)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setAddingColumn(true)}
                className="flex w-full items-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground hover:border-accent hover:text-accent"
              >
                <Plus size={16} />
                Adicionar coluna
              </button>
            )}
          </div>
        </div>

        <DragOverlay>
          {activeCard && (
            <div className="w-72 rotate-2 rounded-lg border border-accent bg-background p-3 text-sm text-foreground shadow-lg">
              {activeCard.title}
            </div>
          )}
          {activeColumn && (
            <div className="w-72 rotate-1 rounded-xl border border-accent bg-surface p-2.5 text-sm font-medium text-foreground shadow-lg">
              {activeColumn.name}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {openCard && (
        <CardModal
          card={openCard}
          workspaceId={workspaceId}
          userId={userId}
          crm={crm}
          onClose={() => {
            fetchCardMeta([openCard.id])
            setOpenCard(null)
          }}
          onUpdated={handleCardUpdated}
          onDeleted={deleteCard}
          onDuplicate={duplicateCard}
        />
      )}

      {importingSheet && (
        <ImportSpreadsheetModal
          columns={columns}
          onClose={() => setImportingSheet(false)}
          onImported={(count) => {
            setImportingSheet(false)
            fetchAll()
            toast(`${count} ${count === 1 ? 'cliente importado' : 'clientes importados'}.`)
          }}
        />
      )}

      {pendingColumnDelete && (
        <ConfirmDialog
          title={`Excluir a coluna "${pendingColumnDelete.name}"?`}
          description="Todos os cards dentro dela também serão excluídos. Essa ação não pode ser desfeita."
          onCancel={() => setPendingColumnDelete(null)}
          onConfirm={() => {
            deleteColumn(pendingColumnDelete.id)
            toast(`Coluna "${pendingColumnDelete.name}" excluída.`)
            setPendingColumnDelete(null)
          }}
        />
      )}

      {pendingCardDelete && (
        <ConfirmDialog
          title={`Excluir o card "${pendingCardDelete.title}"?`}
          description="Checklists, comentários e anexos desse card também serão excluídos. Essa ação não pode ser desfeita."
          onCancel={() => setPendingCardDelete(null)}
          onConfirm={() => {
            deleteCard(pendingCardDelete.id)
            toast(`Card "${pendingCardDelete.title}" excluído.`)
            setPendingCardDelete(null)
          }}
        />
      )}

      {bulkDeleting && (
        <ConfirmDialog
          title={`Excluir ${selectedCardIds.size} ${selectedCardIds.size === 1 ? 'card' : 'cards'}?`}
          description="Checklists, comentários e anexos desses cards também serão excluídos. Essa ação não pode ser desfeita."
          onCancel={() => setBulkDeleting(false)}
          onConfirm={confirmBulkDelete}
        />
      )}

      {confettiActive && <Confetti onDone={() => setConfettiActive(false)} />}
    </div>
  )
}
