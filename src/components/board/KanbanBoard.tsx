"use client"
import { useEffect, useState } from 'react'
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
import { Plus } from '@phosphor-icons/react/dist/ssr'
import { supabase } from '../../lib/supabaseClient'
import type { BoardColumn as BoardColumnType, Card } from '../../../supabase/types'
import { BoardColumn } from './BoardColumn'
import { CardModal } from './CardModal'

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
}: {
  boardId: string
  workspaceId: string
  userId: string
}) {
  const [columns, setColumns] = useState<BoardColumnType[]>([])
  const [cardsByColumn, setCardsByColumn] = useState<Record<string, Card[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addingColumn, setAddingColumn] = useState(false)
  const [columnName, setColumnName] = useState('')
  const [activeCard, setActiveCard] = useState<Card | null>(null)
  const [activeColumn, setActiveColumn] = useState<BoardColumnType | null>(null)
  const [openCard, setOpenCard] = useState<Card | null>(null)
  const [cardMeta, setCardMeta] = useState<Record<string, CardMeta>>({})
  const [members, setMembers] = useState<Record<string, string>>({})

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    fetchMembers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId])

  async function fetchMembers() {
    const { data: memberships } = await supabase.from('memberships').select('user_id').eq('workspace_id', workspaceId)
    const ids = ((memberships ?? []) as { user_id: string }[]).map((m) => m.user_id)
    if (ids.length === 0) return
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, email').in('id', ids)
    const map: Record<string, string> = {}
    for (const p of (profiles ?? []) as { id: string; full_name: string | null; email: string }[]) {
      map[p.id] = p.full_name || p.email
    }
    setMembers(map)
  }

  useEffect(() => {
    fetchAll()
  }, [boardId])

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

  async function addCard(columnId: string, title: string) {
    const position = cardsByColumn[columnId]?.length ?? 0
    const { data, error } = await supabase
      .from('cards')
      .insert({ column_id: columnId, title, position, created_by: userId })
      .select()
      .single()
    if (error) return setError(error.message)
    setCardsByColumn((prev) => ({ ...prev, [columnId]: [...(prev[columnId] ?? []), data as Card] }))
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

  return (
    <div>
      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex items-start gap-4 overflow-x-auto pb-4">
          <SortableContext items={columns.map((c) => `col-sort:${c.id}`)} strategy={horizontalListSortingStrategy}>
            {columns.map((column) => (
              <BoardColumn
                key={column.id}
                column={column}
                cards={cardsByColumn[column.id] ?? []}
                cardMeta={cardMeta}
                members={members}
                onRename={renameColumn}
                onDelete={deleteColumn}
                onAddCard={addCard}
                onDeleteCard={deleteCard}
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
          onClose={() => {
            fetchCardMeta([openCard.id])
            setOpenCard(null)
          }}
          onUpdated={handleCardUpdated}
          onDeleted={deleteCard}
        />
      )}
    </div>
  )
}
