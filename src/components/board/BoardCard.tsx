"use client"
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CalendarBlank, ChatCircle, CheckSquare, Paperclip, X } from '@phosphor-icons/react/dist/ssr'
import type { Card } from '../../../supabase/types'
import type { CardMeta } from './KanbanBoard'
import { Avatar } from '../ui/Avatar'
import { labelColor } from './labelColors'

const priorityDot: Record<string, string> = {
  low: 'bg-muted-foreground',
  medium: 'bg-warning',
  high: 'bg-destructive',
}

function formatShortDate(iso: string) {
  const [, month, day] = iso.split('-')
  return `${day}/${month}`
}

export function BoardCard({
  card,
  meta,
  members,
  memberAvatars,
  selected,
  onToggleSelect,
  onDelete,
  onOpen,
}: {
  card: Card
  meta?: CardMeta
  members: Record<string, string>
  memberAvatars: Record<string, string | null>
  selected: boolean
  onToggleSelect: (id: string) => void
  onDelete: (id: string) => void
  onOpen: (card: Card) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card', columnId: card.column_id },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const priority = card.metadata?.priority
  const dueDate = card.metadata?.due_date
  const isOverdue = !!dueDate && dueDate < new Date().toISOString().slice(0, 10)
  const checklistTotal = meta?.checklistTotal ?? 0
  const checklistDone = meta?.checklistDone ?? 0
  const checklistComplete = checklistTotal > 0 && checklistDone === checklistTotal
  const hasBadges = !!dueDate || checklistTotal > 0 || (meta?.comments ?? 0) > 0 || (meta?.attachments ?? 0) > 0
  const labels = card.metadata?.labels ?? []
  const assignees = (card.metadata?.assignee_ids ?? [])
    .filter((id) => members[id])
    .map((id) => ({ id, name: members[id], avatarUrl: memberAvatars[id] ?? null }))

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(card)}
      className={`group flex flex-col gap-2 rounded-lg border p-3 text-left shadow-sm transition-colors ${
        selected ? 'border-accent bg-accent/5' : 'border-border bg-background hover:border-accent/50'
      }`}
    >
      {labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {labels.map((label) => (
            <span
              key={label}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium leading-none ${labelColor(label)}`}
            >
              {label}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={selected}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onChange={() => onToggleSelect(card.id)}
          aria-label={`Selecionar ${card.title}`}
          className={`mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer accent-accent transition-opacity ${
            selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        />
        {priority && (
          <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${priorityDot[priority]}`} aria-hidden="true" />
        )}
        <span className="flex-1 text-sm text-foreground">{card.title}</span>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onDelete(card.id)
          }}
          className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
          aria-label="Excluir card"
        >
          <X size={14} />
        </button>
      </div>

      {(hasBadges || assignees.length > 0) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-0.5 text-xs text-muted-foreground">
          {dueDate && (
            <span
              className={`inline-flex items-center gap-1 ${isOverdue ? 'font-medium text-destructive' : ''}`}
            >
              <CalendarBlank size={13} />
              {formatShortDate(dueDate)}
            </span>
          )}
          {checklistTotal > 0 && (
            <span className={`inline-flex items-center gap-1 ${checklistComplete ? 'text-accent' : ''}`}>
              <CheckSquare size={13} weight={checklistComplete ? 'fill' : 'regular'} />
              {checklistDone}/{checklistTotal}
            </span>
          )}
          {(meta?.comments ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1">
              <ChatCircle size={13} />
              {meta?.comments}
            </span>
          )}
          {(meta?.attachments ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1">
              <Paperclip size={13} />
              {meta?.attachments}
            </span>
          )}

          {assignees.length > 0 && (
            <span className="ml-auto flex items-center -space-x-1.5">
              {assignees.slice(0, 3).map((a) => (
                <Avatar key={a.id} name={a.name} imageUrl={a.avatarUrl} size={19} className="ring-2 ring-background" />
              ))}
              {assignees.length > 3 && (
                <span className="flex h-[19px] w-[19px] items-center justify-center rounded-full bg-surface text-[9px] font-semibold text-muted-foreground ring-2 ring-background">
                  +{assignees.length - 3}
                </span>
              )}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
