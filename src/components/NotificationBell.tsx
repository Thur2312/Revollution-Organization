"use client"
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { At, Bell, ChatCircle, UserPlus } from '@phosphor-icons/react/dist/ssr'
import { supabase } from '../lib/supabaseClient'
import type { Notification, NotificationType } from '../../supabase/types'

type Row = Notification & {
  cardTitle: string | null
  boardId: string | null
  actorName: string
}

const typeIcon: Record<NotificationType, typeof Bell> = {
  card_assigned: UserPlus,
  card_commented: ChatCircle,
  card_mentioned: At,
}

function typeLabel(row: Row): string {
  if (row.type === 'card_assigned') return `${row.actorName} te atribuiu a "${row.cardTitle ?? 'um card'}"`
  if (row.type === 'card_mentioned') return `${row.actorName} te mencionou em "${row.cardTitle ?? 'um card'}"`
  return `${row.actorName} comentou em "${row.cardTitle ?? 'um card'}"`
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

export function NotificationBell({ userId, collapsed }: { userId: string; collapsed: boolean }) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<Row[] | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const unreadCount = rows?.filter((r) => !r.read_at).length ?? 0

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function fetchNotifications() {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)
    if (error || !data) return

    const list = data as Notification[]
    const cardIds = Array.from(new Set(list.map((n) => n.card_id).filter(Boolean))) as string[]
    const actorIds = Array.from(new Set(list.map((n) => n.actor_id).filter(Boolean))) as string[]

    const [{ data: cards }, { data: actors }] = await Promise.all([
      cardIds.length
        ? supabase.from('cards').select('id, title, column_id, board_columns(board_id)').in('id', cardIds)
        : Promise.resolve({ data: [] as unknown[] }),
      actorIds.length
        ? supabase.from('profiles').select('id, full_name, email').in('id', actorIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string }[] }),
    ])

    type CardRow = { id: string; title: string; board_columns: { board_id: string } | null }
    const cardById = new Map<string, CardRow>(((cards ?? []) as unknown as CardRow[]).map((c) => [c.id, c]))
    const actorById = new Map(
      ((actors ?? []) as { id: string; full_name: string | null; email: string }[]).map((a) => [
        a.id,
        a.full_name || a.email,
      ])
    )

    setRows(
      list.map((n) => ({
        ...n,
        cardTitle: n.card_id ? cardById.get(n.card_id)?.title ?? null : null,
        boardId: n.card_id ? cardById.get(n.card_id)?.board_columns?.board_id ?? null : null,
        actorName: n.actor_id ? actorById.get(n.actor_id) ?? 'Alguém' : 'Alguém',
      }))
    )
  }

  async function openNotification(row: Row) {
    setOpen(false)
    if (!row.read_at) {
      setRows((prev) => (prev ? prev.map((r) => (r.id === row.id ? { ...r, read_at: new Date().toISOString() } : r)) : prev))
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', row.id)
    }
    if (row.boardId && row.card_id) router.push(`/app/board/${row.boardId}?openCard=${row.card_id}`)
  }

  async function markAllRead() {
    setRows((prev) => (prev ? prev.map((r) => ({ ...r, read_at: r.read_at ?? new Date().toISOString() })) : prev))
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId).is('read_at', null)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Notificações"
        aria-label="Notificações"
        className={`relative rounded-md p-1.5 text-muted-foreground hover:bg-surface hover:text-foreground ${
          collapsed ? '' : ''
        }`}
      >
        <Bell size={collapsed ? 18 : 16} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-semibold leading-none text-destructive-foreground">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute left-full top-0 z-50 ml-1.5 w-80 rounded-xl border border-border bg-background py-1.5 shadow-xl"
          style={{ animation: 'dropdown-in 150ms ease-out' }}
        >
          <div className="flex items-center justify-between px-3.5 py-1.5">
            <p className="text-sm font-medium text-primary">Notificações</p>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-muted-foreground hover:text-accent">
                Marcar tudo como lido
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {rows === null ? (
              <p className="px-3.5 py-6 text-center text-sm text-muted-foreground">Carregando…</p>
            ) : rows.length === 0 ? (
              <p className="px-3.5 py-6 text-center text-sm text-muted-foreground">Nenhuma notificação ainda.</p>
            ) : (
              rows.map((row) => {
                const Icon = typeIcon[row.type]
                return (
                  <button
                    key={row.id}
                    onClick={() => openNotification(row)}
                    className={`flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left hover:bg-surface ${
                      !row.read_at ? 'bg-accent/5' : ''
                    }`}
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                      <Icon size={14} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-foreground">{typeLabel(row)}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{timeAgo(row.created_at)}</span>
                    </span>
                    {!row.read_at && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
