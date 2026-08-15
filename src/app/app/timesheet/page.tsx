"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../../lib/supabaseClient'
import { useAppSession } from '../../../lib/AppSessionContext'
import { todayLocal } from '../../../lib/timesheet'
import { Avatar } from '../../../components/ui/Avatar'

type EntryRow = { user_id: string; started_at: string; last_seen_at: string; ended_at: string | null }
type ProfileRow = { id: string; full_name: string | null; email: string; avatar_url: string | null }

type Row = {
  userId: string
  name: string
  avatarUrl: string | null
  startedAt: string
  endedAt: string | null
  lastSeenAt: string
  active: boolean
  durationMs: number
}

const ACTIVE_WINDOW_MS = 5 * 60_000

function formatDuration(ms: number) {
  const totalMinutes = Math.max(0, Math.round(ms / 60_000))
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${h}h ${String(m).padStart(2, '0')}m`
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function TimesheetPage() {
  const { loading, isPlatformAdmin } = useAppSession()
  const [date, setDate] = useState(todayLocal())
  const [rows, setRows] = useState<Row[] | null>(null)

  useEffect(() => {
    if (!isPlatformAdmin) return
    let mounted = true

    async function load() {
      const [{ data: entries }, { data: profiles }] = await Promise.all([
        supabase.from('time_entries').select('user_id, started_at, last_seen_at, ended_at').eq('work_date', date),
        supabase.from('profiles').select('id, full_name, email, avatar_url'),
      ])
      const profileById = new Map(((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p]))

      const nextRows: Row[] = ((entries ?? []) as EntryRow[]).map((e) => {
        const profile = profileById.get(e.user_id)
        const active = !e.ended_at && Date.now() - new Date(e.last_seen_at).getTime() < ACTIVE_WINDOW_MS
        const endpoint = e.ended_at ?? e.last_seen_at
        return {
          userId: e.user_id,
          name: profile?.full_name || profile?.email || 'Alguém',
          avatarUrl: profile?.avatar_url ?? null,
          startedAt: e.started_at,
          endedAt: e.ended_at,
          lastSeenAt: e.last_seen_at,
          active,
          durationMs: new Date(endpoint).getTime() - new Date(e.started_at).getTime(),
        }
      })
      nextRows.sort((a, b) => b.durationMs - a.durationMs)
      if (mounted) setRows(nextRows)
    }
    load()
    return () => {
      mounted = false
    }
  }, [isPlatformAdmin, date])

  if (loading) return null

  if (!isPlatformAdmin) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
        <p className="text-sm text-muted-foreground">Você não tem acesso a essa página.</p>
        <Link href="/app" className="mt-2 inline-block text-sm text-accent hover:underline">
          Voltar
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-primary">Timesheet</h1>
      <p className="mb-6 text-sm text-muted-foreground">Tempo de cada colaborador na plataforma.</p>

      <input
        type="date"
        value={date}
        max={todayLocal()}
        onChange={(e) => setDate(e.target.value)}
        className="mb-6 h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-accent"
      />

      {rows === null ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ninguém acessou a plataforma nesse dia.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <div key={r.userId} className="flex items-center gap-3 rounded-xl border border-border bg-background p-3.5">
              <Avatar name={r.name} imageUrl={r.avatarUrl} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{r.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatTime(r.startedAt)} – {r.endedAt ? formatTime(r.endedAt) : r.active ? 'agora' : formatTime(r.lastSeenAt)}
                </p>
              </div>
              {r.active && (
                <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Online
                </span>
              )}
              <span className="shrink-0 text-sm font-semibold text-foreground">{formatDuration(r.durationMs)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
