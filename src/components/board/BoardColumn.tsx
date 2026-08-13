"use client"
import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DotsThree, Plus, X } from '@phosphor-icons/react/dist/ssr'
import type { BoardColumn as BoardColumnType, Card } from '../../../supabase/types'
import { BoardCard } from './BoardCard'
import type { CardMeta } from './KanbanBoard'

export function BoardColumn({
  column,
  cards,
  cardMeta,
  members,
  onRename,
  onDelete,
  onAddCard,
  onDeleteCard,
  onOpenCard,
}: {
  column: BoardColumnType
  cards: Card[]
  cardMeta: Record<string, CardMeta>
  members: Record<string, string>
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onAddCard: (columnId: string, title: string) => void
  onDeleteCard: (id: string) => void
  onOpenCard: (card: Card) => void
}) {
  // Two distinct id namespaces on purpose: `column.id` is the drop target
  // cards land on (read by KanbanBoard's card drag-end logic), while
  // `col-sort:${column.id}` is the sortable handle for reordering columns
  // themselves. Reusing the same id for both would make dnd-kit register
  // two different nodes under one id and break hit-testing for one of them.
  const { setNodeRef: setDropRef } = useDroppable({ id: column.id, data: { type: 'column' } })
  const {
    setNodeRef: setSortRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `col-sort:${column.id}`, data: { type: 'column' } })
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(column.name)
  const [addingCard, setAddingCard] = useState(false)
  const [cardTitle, setCardTitle] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  function commitRename() {
    setEditingName(false)
    const trimmed = name.trim()
    if (trimmed && trimmed !== column.name) onRename(column.id, trimmed)
    else setName(column.name)
  }

  function submitCard(e: React.FormEvent) {
    e.preventDefault()
    if (!cardTitle.trim()) return
    onAddCard(column.id, cardTitle.trim())
    setCardTitle('')
    setAddingCard(false)
  }

  return (
    <div
      ref={setSortRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="flex w-72 shrink-0 flex-col rounded-xl border border-border bg-surface"
    >
      <div
        {...(editingName ? {} : attributes)}
        {...(editingName ? {} : listeners)}
        className="flex items-center justify-between gap-2 px-3 py-2.5"
      >
        {editingName ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') {
                setName(column.name)
                setEditingName(false)
              }
            }}
            className="w-full rounded-md border border-accent bg-background px-2 py-1 text-sm font-medium text-foreground outline-none"
          />
        ) : (
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={() => setEditingName(true)}
              className="truncate text-sm font-medium text-foreground hover:text-primary"
            >
              {column.name}
            </button>
            {cards.length > 0 && (
              <span className="shrink-0 rounded-full bg-border/60 px-1.5 py-0.5 text-[11px] font-medium leading-none text-muted-foreground">
                {cards.length}
              </span>
            )}
          </div>
        )}
        <div className="relative shrink-0">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded p-1 text-muted-foreground hover:bg-border/60 hover:text-foreground"
            aria-label="Opções da coluna"
          >
            <DotsThree size={18} weight="bold" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-10 mt-1 w-36 rounded-lg border border-border bg-background py-1 shadow-sm">
              <button
                onClick={() => {
                  setMenuOpen(false)
                  onDelete(column.id)
                }}
                className="flex w-full items-center px-3 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10"
              >
                Excluir coluna
              </button>
            </div>
          )}
        </div>
      </div>

      <div ref={setDropRef} className="flex min-h-[2rem] flex-1 flex-col gap-2 px-2 pb-2">
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <BoardCard
              key={card.id}
              card={card}
              meta={cardMeta[card.id]}
              members={members}
              onDelete={onDeleteCard}
              onOpen={onOpenCard}
            />
          ))}
        </SortableContext>
      </div>

      <div className="px-2 pb-2">
        {addingCard ? (
          <form onSubmit={submitCard} className="flex flex-col gap-1.5">
            <textarea
              autoFocus
              rows={2}
              value={cardTitle}
              onChange={(e) => setCardTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submitCard(e)
                }
                if (e.key === 'Escape') {
                  setAddingCard(false)
                  setCardTitle('')
                }
              }}
              placeholder="Título do card"
              className="w-full resize-none rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
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
                onClick={() => {
                  setAddingCard(false)
                  setCardTitle('')
                }}
                className="rounded p-1 text-muted-foreground hover:text-foreground"
                aria-label="Cancelar"
              >
                <X size={14} />
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setAddingCard(true)}
            className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:bg-border/40 hover:text-foreground"
          >
            <Plus size={16} />
            Adicionar card
          </button>
        )}
      </div>
    </div>
  )
}
