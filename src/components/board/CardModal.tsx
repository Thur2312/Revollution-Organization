"use client"
import { useEffect, useState } from 'react'
import {
  CalendarBlank,
  CaretDown,
  Check,
  Flag,
  Paperclip,
  Plus,
  Trash,
  X,
} from '@phosphor-icons/react/dist/ssr'
import { supabase } from '../../lib/supabaseClient'
import type {
  Attachment,
  Card,
  CardMetadata,
  CardPriority,
  Checklist,
  ChecklistItem,
  Comment,
  Profile,
} from '../../../supabase/types'
import { Avatar } from '../ui/Avatar'
import { labelColor } from './labelColors'

type WorkspaceMember = { id: string; name: string }

type CommentWithAuthor = Comment & { authorName: string }

const priorityLabel: Record<CardPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
}

const priorityColor: Record<CardPriority, string> = {
  low: 'text-muted-foreground',
  medium: 'text-warning',
  high: 'text-destructive',
}

const priorityFieldStyle: Record<CardPriority | 'none', string> = {
  none: 'border-border bg-background text-muted-foreground',
  low: 'border-border bg-surface text-foreground',
  medium: 'border-warning/30 bg-warning/10 text-warning',
  high: 'border-destructive/30 bg-destructive/10 text-destructive',
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatBytes(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function CardModal({
  card,
  workspaceId,
  userId,
  onClose,
  onUpdated,
  onDeleted,
}: {
  card: Card
  workspaceId: string
  userId: string
  onClose: () => void
  onUpdated: (card: Card) => void
  onDeleted: (id: string) => void
}) {
  const [title, setTitle] = useState(card.title)
  const [description, setDescription] = useState(card.description ?? '')
  const [metadata, setMetadata] = useState<CardMetadata>(card.metadata ?? {})

  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [itemsByChecklist, setItemsByChecklist] = useState<Record<string, ChecklistItem[]>>({})
  const [comments, setComments] = useState<CommentWithAuthor[]>([])
  const [attachments, setAttachments] = useState<Attachment[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [newChecklistTitle, setNewChecklistTitle] = useState('')
  const [addingChecklist, setAddingChecklist] = useState(false)
  const [newItemText, setNewItemText] = useState<Record<string, string>>({})
  const [newComment, setNewComment] = useState('')
  const [posting, setPosting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [newLabel, setNewLabel] = useState('')

  const isOverdue = !!metadata.due_date && metadata.due_date < new Date().toISOString().slice(0, 10)

  useEffect(() => {
    fetchDetails()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id])

  useEffect(() => {
    fetchMembers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId])

  async function fetchMembers() {
    const { data: memberships } = await supabase.from('memberships').select('user_id').eq('workspace_id', workspaceId)
    const ids = ((memberships ?? []) as { user_id: string }[]).map((m) => m.user_id)
    if (ids.length === 0) return
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, email').in('id', ids)
    setMembers(
      ((profiles ?? []) as Pick<Profile, 'id' | 'full_name' | 'email'>[]).map((p) => ({
        id: p.id,
        name: p.full_name || p.email,
      }))
    )
  }

  function toggleAssignee(id: string) {
    const current = metadata.assignee_ids ?? []
    const next = current.includes(id) ? current.filter((a) => a !== id) : [...current, id]
    saveMetadata({ assignee_ids: next })
  }

  function addLabel(e: React.FormEvent) {
    e.preventDefault()
    const value = newLabel.trim()
    if (!value) return
    const current = metadata.labels ?? []
    if (current.includes(value)) {
      setNewLabel('')
      return
    }
    saveMetadata({ labels: [...current, value] })
    setNewLabel('')
  }

  function removeLabel(value: string) {
    saveMetadata({ labels: (metadata.labels ?? []).filter((l) => l !== value) })
  }

  async function fetchDetails() {
    setLoading(true)
    const [checklistRes, commentRes, attachmentRes] = await Promise.all([
      supabase.from('checklists').select('*').eq('card_id', card.id).order('position', { ascending: true }),
      supabase.from('comments').select('*').eq('card_id', card.id).order('created_at', { ascending: true }),
      supabase.from('attachments').select('*').eq('card_id', card.id).order('created_at', { ascending: true }),
    ])

    if (checklistRes.error || commentRes.error || attachmentRes.error) {
      setError((checklistRes.error ?? commentRes.error ?? attachmentRes.error)?.message ?? 'Erro ao carregar cartão')
      setLoading(false)
      return
    }

    const checklistList = (checklistRes.data ?? []) as Checklist[]
    setChecklists(checklistList)
    setAttachments((attachmentRes.data ?? []) as Attachment[])

    if (checklistList.length > 0) {
      const { data: items } = await supabase
        .from('checklist_items')
        .select('*')
        .in('checklist_id', checklistList.map((c) => c.id))
        .order('position', { ascending: true })
      const grouped: Record<string, ChecklistItem[]> = {}
      for (const c of checklistList) grouped[c.id] = []
      for (const item of (items ?? []) as ChecklistItem[]) grouped[item.checklist_id]?.push(item)
      setItemsByChecklist(grouped)
    } else {
      setItemsByChecklist({})
    }

    const commentList = (commentRes.data ?? []) as Comment[]
    if (commentList.length > 0) {
      const authorIds = Array.from(new Set(commentList.map((c) => c.user_id)))
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, email').in('id', authorIds)
      const nameById = new Map<string, string>(
        ((profiles ?? []) as Pick<Profile, 'id' | 'full_name' | 'email'>[]).map((p) => [p.id, p.full_name || p.email])
      )
      setComments(commentList.map((c) => ({ ...c, authorName: nameById.get(c.user_id) ?? 'Usuário' })))
    } else {
      setComments([])
    }

    setLoading(false)
  }

  async function saveTitle() {
    const trimmed = title.trim()
    if (!trimmed || trimmed === card.title) {
      setTitle(card.title)
      return
    }
    const { error } = await supabase.from('cards').update({ title: trimmed }).eq('id', card.id)
    if (error) return setError(error.message)
    onUpdated({ ...card, title: trimmed, metadata })
  }

  async function saveDescription() {
    const value = description.trim() || null
    if (value === card.description) return
    const { error } = await supabase.from('cards').update({ description: value }).eq('id', card.id)
    if (error) return setError(error.message)
    onUpdated({ ...card, title, description: value, metadata })
  }

  async function saveMetadata(patch: Partial<CardMetadata>) {
    const next: CardMetadata = { ...metadata, ...patch }
    if (patch.due_date === '') delete next.due_date
    if (patch.priority === undefined && 'priority' in patch) delete next.priority
    setMetadata(next)
    const { error } = await supabase.from('cards').update({ metadata: next }).eq('id', card.id)
    if (error) return setError(error.message)
    onUpdated({ ...card, title, metadata: next })
  }

  async function deleteCard() {
    const { error } = await supabase.from('cards').delete().eq('id', card.id)
    if (error) return setError(error.message)
    onDeleted(card.id)
    onClose()
  }

  async function addChecklist(e: React.FormEvent) {
    e.preventDefault()
    if (!newChecklistTitle.trim()) return
    const { data, error } = await supabase
      .from('checklists')
      .insert({ card_id: card.id, title: newChecklistTitle.trim(), position: checklists.length })
      .select()
      .single()
    if (error) return setError(error.message)
    setChecklists((prev) => [...prev, data as Checklist])
    setItemsByChecklist((prev) => ({ ...prev, [(data as Checklist).id]: [] }))
    setNewChecklistTitle('')
    setAddingChecklist(false)
  }

  async function deleteChecklist(id: string) {
    setChecklists((prev) => prev.filter((c) => c.id !== id))
    setItemsByChecklist((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    const { error } = await supabase.from('checklists').delete().eq('id', id)
    if (error) setError(error.message)
  }

  async function addChecklistItem(checklistId: string) {
    const text = (newItemText[checklistId] ?? '').trim()
    if (!text) return
    const position = itemsByChecklist[checklistId]?.length ?? 0
    const { data, error } = await supabase
      .from('checklist_items')
      .insert({ checklist_id: checklistId, text, position })
      .select()
      .single()
    if (error) return setError(error.message)
    setItemsByChecklist((prev) => ({
      ...prev,
      [checklistId]: [...(prev[checklistId] ?? []), data as ChecklistItem],
    }))
    setNewItemText((prev) => ({ ...prev, [checklistId]: '' }))
  }

  async function toggleChecklistItem(item: ChecklistItem) {
    setItemsByChecklist((prev) => ({
      ...prev,
      [item.checklist_id]: prev[item.checklist_id].map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)),
    }))
    const { error } = await supabase.from('checklist_items').update({ done: !item.done }).eq('id', item.id)
    if (error) setError(error.message)
  }

  async function deleteChecklistItem(item: ChecklistItem) {
    setItemsByChecklist((prev) => ({
      ...prev,
      [item.checklist_id]: prev[item.checklist_id].filter((i) => i.id !== item.id),
    }))
    const { error } = await supabase.from('checklist_items').delete().eq('id', item.id)
    if (error) setError(error.message)
  }

  async function postComment(e: React.FormEvent) {
    e.preventDefault()
    if (!newComment.trim()) return
    setPosting(true)
    const { data, error } = await supabase
      .from('comments')
      .insert({ card_id: card.id, user_id: userId, text: newComment.trim() })
      .select()
      .single()
    setPosting(false)
    if (error) return setError(error.message)
    setComments((prev) => [...prev, { ...(data as Comment), authorName: 'Você' }])
    setNewComment('')
  }

  async function deleteComment(id: string) {
    setComments((prev) => prev.filter((c) => c.id !== id))
    const { error } = await supabase.from('comments').delete().eq('id', id)
    if (error) setError(error.message)
  }

  async function uploadAttachment(file: File) {
    setUploading(true)
    setError(null)
    const path = `${workspaceId}/${card.id}/${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage.from('attachments').upload(path, file)
    if (uploadError) {
      setUploading(false)
      return setError(uploadError.message)
    }
    const { data, error } = await supabase
      .from('attachments')
      .insert({
        card_id: card.id,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
        uploaded_by: userId,
      })
      .select()
      .single()
    setUploading(false)
    if (error) return setError(error.message)
    setAttachments((prev) => [...prev, data as Attachment])
  }

  async function openAttachment(attachment: Attachment) {
    const { data, error } = await supabase.storage.from('attachments').createSignedUrl(attachment.storage_path, 60)
    if (error || !data) return setError(error?.message ?? 'Não foi possível abrir o anexo')
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  async function deleteAttachment(attachment: Attachment) {
    setAttachments((prev) => prev.filter((a) => a.id !== attachment.id))
    await supabase.storage.from('attachments').remove([attachment.storage_path])
    const { error } = await supabase.from('attachments').delete().eq('id', attachment.id)
    if (error) setError(error.message)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-primary/40 px-4 py-10 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-2xl border border-border bg-background shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            rows={1}
            className="w-full resize-none bg-transparent text-lg font-semibold text-primary outline-none focus:text-foreground"
          />
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-surface hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto px-6 py-5">
          {error && (
            <p role="alert" className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="relative">
              <Flag
                size={13}
                weight={metadata.priority ? 'fill' : 'regular'}
                className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${
                  metadata.priority ? priorityColor[metadata.priority] : 'text-muted-foreground'
                }`}
              />
              <select
                value={metadata.priority ?? ''}
                onChange={(e) => saveMetadata({ priority: (e.target.value || undefined) as CardPriority | undefined })}
                className={`h-9 appearance-none rounded-lg border pl-8 pr-8 text-sm font-medium outline-none transition-colors focus:ring-2 focus:ring-accent/30 ${
                  priorityFieldStyle[metadata.priority ?? 'none']
                }`}
              >
                <option value="">Sem prioridade</option>
                <option value="low">{priorityLabel.low}</option>
                <option value="medium">{priorityLabel.medium}</option>
                <option value="high">{priorityLabel.high}</option>
              </select>
              <CaretDown
                size={11}
                weight="bold"
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 opacity-60"
              />
            </div>

            <div
              className={`flex h-9 items-center gap-1.5 rounded-lg border pl-3 pr-3 text-sm transition-colors ${
                isOverdue
                  ? 'border-destructive/30 bg-destructive/10 text-destructive'
                  : 'border-border bg-background text-foreground'
              }`}
            >
              <CalendarBlank size={14} className={isOverdue ? 'text-destructive' : 'text-muted-foreground'} />
              <input
                type="date"
                value={metadata.due_date ?? ''}
                onChange={(e) => saveMetadata({ due_date: e.target.value })}
                className="h-full bg-transparent text-sm outline-none [color-scheme:light]"
              />
            </div>
          </div>

          {members.length > 0 && (
            <section className="mb-6">
              <h3 className="mb-2 text-sm font-medium text-primary">Responsáveis</h3>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => {
                  const active = (metadata.assignee_ids ?? []).includes(m.id)
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleAssignee(m.id)}
                      className={`flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-xs transition-colors ${
                        active
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border text-muted-foreground hover:border-accent/40'
                      }`}
                    >
                      <Avatar name={m.name} size={18} />
                      {m.name}
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          <section className="mb-6">
            <h3 className="mb-2 text-sm font-medium text-primary">Labels</h3>
            <div className="flex flex-wrap items-center gap-1.5">
              {(metadata.labels ?? []).map((label) => (
                <span
                  key={label}
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${labelColor(label)}`}
                >
                  {label}
                  <button
                    type="button"
                    onClick={() => removeLabel(label)}
                    className="opacity-60 hover:opacity-100"
                    aria-label={`Remover label ${label}`}
                  >
                    <X size={11} weight="bold" />
                  </button>
                </span>
              ))}
              <form onSubmit={addLabel}>
                <input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Nova label"
                  className="h-7 w-28 rounded-full border border-dashed border-border bg-background px-3 text-xs text-foreground outline-none focus:border-accent"
                />
              </form>
            </div>
          </section>

          <section className="mb-6">
            <h3 className="mb-2 text-sm font-medium text-primary">Descrição</h3>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={saveDescription}
              rows={3}
              placeholder="Adicione uma descrição mais detalhada..."
              className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
          </section>

          <section className="mb-6">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-medium text-primary">Checklists</h3>
            </div>

            {!loading && checklists.length === 0 && (
              <p className="mb-2 text-sm text-muted-foreground">Nenhuma checklist ainda.</p>
            )}

            <div className="flex flex-col gap-4">
              {checklists.map((checklist) => {
                const items = itemsByChecklist[checklist.id] ?? []
                const done = items.filter((i) => i.done).length
                const pct = items.length ? Math.round((done / items.length) * 100) : 0
                return (
                  <div key={checklist.id}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{checklist.title}</span>
                      <button
                        onClick={() => deleteChecklist(checklist.id)}
                        aria-label="Excluir checklist"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                    {items.length > 0 && (
                      <div className="mb-2 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
                          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-9 text-right text-xs text-muted-foreground">{pct}%</span>
                      </div>
                    )}
                    <ul className="flex flex-col gap-1">
                      {items.map((item) => (
                        <li key={item.id} className="group flex items-center gap-2">
                          <button
                            onClick={() => toggleChecklistItem(item)}
                            aria-label={item.done ? 'Marcar como não feito' : 'Marcar como feito'}
                            className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border ${
                              item.done ? 'border-accent bg-accent text-accent-foreground' : 'border-border'
                            }`}
                          >
                            {item.done && <Check size={11} weight="bold" />}
                          </button>
                          <span className={`flex-1 text-sm ${item.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                            {item.text}
                          </span>
                          <button
                            onClick={() => deleteChecklistItem(item)}
                            aria-label="Excluir item"
                            className="shrink-0 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                          >
                            <X size={13} />
                          </button>
                        </li>
                      ))}
                    </ul>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        addChecklistItem(checklist.id)
                      }}
                      className="mt-1.5"
                    >
                      <input
                        value={newItemText[checklist.id] ?? ''}
                        onChange={(e) => setNewItemText((prev) => ({ ...prev, [checklist.id]: e.target.value }))}
                        placeholder="Adicionar item"
                        className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                      />
                    </form>
                  </div>
                )
              })}
            </div>

            {addingChecklist ? (
              <form onSubmit={addChecklist} className="mt-3 flex items-center gap-2">
                <input
                  autoFocus
                  value={newChecklistTitle}
                  onChange={(e) => setNewChecklistTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Escape' && setAddingChecklist(false)}
                  placeholder="Nome da checklist"
                  className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                />
                <button type="submit" className="rounded-md bg-accent px-2.5 py-1.5 text-xs font-medium text-accent-foreground hover:bg-accent/90">
                  Adicionar
                </button>
                <button type="button" onClick={() => setAddingChecklist(false)} className="text-xs text-muted-foreground hover:text-foreground">
                  Cancelar
                </button>
              </form>
            ) : (
              <button
                onClick={() => setAddingChecklist(true)}
                className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-accent"
              >
                <Plus size={16} />
                Adicionar checklist
              </button>
            )}
          </section>

          <section className="mb-6">
            <h3 className="mb-2 text-sm font-medium text-primary">Anexos</h3>
            {attachments.length > 0 && (
              <ul className="mb-2 flex flex-col gap-1.5">
                {attachments.map((a) => (
                  <li key={a.id} className="group flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
                    <Paperclip size={15} className="shrink-0 text-muted-foreground" />
                    <button onClick={() => openAttachment(a)} className="flex-1 truncate text-left text-sm text-foreground hover:text-accent">
                      {a.file_name}
                    </button>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(a.size_bytes)}</span>
                    <button
                      onClick={() => deleteAttachment(a)}
                      aria-label="Excluir anexo"
                      className="shrink-0 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                    >
                      <Trash size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <label className="flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-accent hover:text-accent">
              <Plus size={16} />
              {uploading ? 'Enviando...' : 'Adicionar anexo'}
              <input
                type="file"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) uploadAttachment(file)
                  e.target.value = ''
                }}
              />
            </label>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-medium text-primary">Comentários</h3>
            <div className="mb-3 flex flex-col gap-3">
              {comments.map((c) => (
                <div key={c.id} className="group rounded-lg border border-border bg-surface px-3 py-2">
                  <div className="mb-0.5 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-foreground">{c.authorName}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{formatDateTime(c.created_at)}</span>
                      {c.user_id === userId && (
                        <button
                          onClick={() => deleteComment(c.id)}
                          aria-label="Excluir comentário"
                          className="text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-foreground">{c.text}</p>
                </div>
              ))}
            </div>
            <form onSubmit={postComment} className="flex flex-col gap-2">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={2}
                placeholder="Escreva um comentário..."
                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
              />
              <button
                type="submit"
                disabled={posting || !newComment.trim()}
                className="w-fit rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
              >
                Comentar
              </button>
            </form>
          </section>
        </div>

        <div className="flex items-center justify-between border-t border-border px-6 py-3">
          {confirmingDelete ? (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-foreground">Excluir este card?</span>
              <button onClick={deleteCard} className="font-medium text-destructive hover:underline">
                Sim, excluir
              </button>
              <button
                onClick={() => setConfirmingDelete(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="flex items-center gap-1.5 text-sm text-destructive hover:underline"
            >
              <Trash size={15} />
              Excluir card
            </button>
          )}
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
