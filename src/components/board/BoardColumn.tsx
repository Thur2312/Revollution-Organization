"use client"
import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Broom, Check, DotsThree, Plus, X } from '@phosphor-icons/react/dist/ssr'
import type { BoardColumn as BoardColumnType, BoardColor, Card } from '../../../supabase/types'
import { BoardCard } from './BoardCard'
import {
  BOARD_COLORS,
  DEFAULT_COLUMN_ACCENT,
  boardColorClasses,
  boardColorLabel,
  columnColorAccent,
  crmStageAccent,
} from './boardColors'
import type { CardMeta } from './KanbanBoard'

export function BoardColumn({
  column,
  cards,
  cardMeta,
  members,
  memberAvatars,
  selectedCardIds,
  crm = false,
  onToggleSelect,
  onRename,
  onDelete,
  onClearColumn,
  onAddCard,
  onDeleteCard,
  onOpenCard,
  onToggleCelebrate,
  onChangeColor,
}: {
  column: BoardColumnType
  cards: Card[]
  cardMeta: Record<string, CardMeta>
  members: Record<string, string>
  memberAvatars: Record<string, string | null>
  selectedCardIds: Set<string>
  crm?: boolean
  onToggleSelect: (id: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onClearColumn: (id: string) => void
  onAddCard: (columnId: string, title: string) => void
  onDeleteCard: (id: string) => void
  onOpenCard: (card: Card) => void
  onToggleCelebrate: (columnId: string, next: boolean) => void
  onChangeColor: (columnId: string, color: BoardColor | null) => void
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

  const accent = crm ? crmStageAccent(column.position) : columnColorAccent(column.color)
  // Every column gets a solid pill header — colored ones use their accent,
  // uncolored regular columns fall back to neutral slate. The column BODY
  // stays neutral either way; only the header pill and each card's status
  // tag carry the color (see the reference board this mirrors).
  const headerAccent = accent ?? DEFAULT_COLUMN_ACCENT

  return (
    <div
      ref={setSortRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="flex w-72 shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-surface"
    >
      <div
        {...(editingName ? {} : attributes)}
        {...(editingName ? {} : listeners)}
        className={`mx-2 mt-2 flex items-center justify-between gap-2 rounded-lg px-3 py-2 ${headerAccent.bg}`}
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
            className="w-full rounded-md bg-white/90 px-2 py-1 text-sm font-medium text-foreground outline-none"
          />
        ) : (
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={() => setEditingName(true)}
              className={`truncate text-sm font-semibold hover:opacity-80 ${headerAccent.text}`}
            >
              {column.name}
            </button>
            {cards.length > 0 && (
              <span className={`shrink-0 rounded-full bg-black/10 px-1.5 py-0.5 text-[11px] font-medium leading-none ${headerAccent.subtle}`}>
                {cards.length}
              </span>
            )}
          </div>
        )}
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            onClick={() => onClearColumn(column.id)}
            disabled={cards.length === 0}
            className={`rounded-md bg-black/10 p-1.5 ${headerAccent.text} hover:bg-destructive hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-black/10 disabled:hover:text-current`}
            aria-label={`Excluir todos os cards da coluna "${column.name}"`}
            title="Excluir todos os cards desta coluna (a coluna continua existindo)"
          >
            <Broom size={17} weight="bold" />
          </button>
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className={`rounded p-1 ${headerAccent.subtle} hover:bg-black/10 hover:opacity-100`}
              aria-label="Opções da coluna"
            >
              <DotsThree size={18} weight="bold" />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-full z-10 mt-1 w-48 rounded-lg border border-border bg-background py-1 shadow-sm"
                style={{ animation: 'dropdown-in 150ms ease-out' }}
              >
                {!crm && (
                  <div className="px-3 py-1.5">
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">Cor da coluna</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false)
                          onChangeColor(column.id, null)
                        }}
                        title="Sem cor"
                        aria-label="Sem cor"
                        aria-pressed={!column.color}
                        className={`flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-muted-foreground/50 transition-transform hover:scale-110 ${
                          !column.color ? 'ring-2 ring-offset-1 ring-offset-background ring-primary/40' : ''
                        }`}
                      >
                        {!column.color && <Check size={10} weight="bold" className="text-foreground" />}
                      </button>
                      {BOARD_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => {
                            setMenuOpen(false)
                            onChangeColor(column.id, c)
                          }}
                          title={boardColorLabel(c)}
                          aria-label={boardColorLabel(c)}
                          aria-pressed={column.color === c}
                          className={`flex h-5 w-5 items-center justify-center rounded-full ${boardColorClasses(c).dot} transition-transform hover:scale-110 ${
                            column.color === c ? 'ring-2 ring-offset-1 ring-offset-background ring-primary/40' : ''
                          }`}
                        >
                          {column.color === c && <Check size={10} weight="bold" className="text-white" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {crm && (
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      onToggleCelebrate(column.id, !column.celebrate_on_card)
                    }}
                    className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-sm text-foreground hover:bg-border/40"
                  >
                    🎉 {column.celebrate_on_card ? 'Desativar confete' : 'Confete ao adicionar card'}
                  </button>
                )}
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
      </div>

      <div ref={setDropRef} className="flex min-h-[2rem] flex-1 flex-col gap-2 px-2 pb-2">
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <BoardCard
              key={card.id}
              card={card}
              meta={cardMeta[card.id]}
              members={members}
              memberAvatars={memberAvatars}
              selected={selectedCardIds.has(card.id)}
              onToggleSelect={onToggleSelect}
              onDelete={onDeleteCard}
              onOpen={onOpenCard}
              crm={crm}
              columnName={column.name}
              accentBg={headerAccent.bg}
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
              placeholder={crm ? 'Nome do cliente' : 'Título do card'}
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
            {crm ? 'Adicionar cliente' : 'Adicionar card'}
          </button>
        )}
      </div>
    </div>
  )
}
