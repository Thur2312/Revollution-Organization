"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { SquaresFour, Plus, UsersThree } from '@phosphor-icons/react/dist/ssr'
import { supabase } from '../lib/supabaseClient'
import { refreshSidebar } from '../lib/sidebarRefresh'
import { Field } from './ui/Field'
import { Button } from './ui/Button'
import type { MemberRole } from '../../supabase/types'

type Workspace = {
  id: string
  name: string
}

type WorkspaceMeta = {
  boardCount: number
  memberCount: number
  latestBoardName: string | null
  role: MemberRole
}

const roleLabel: Record<MemberRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Membro',
  guest: 'Convidado',
}

function monogramStyle(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i)) % 2
  return hash === 0 ? 'bg-primary text-primary-foreground' : 'bg-accent text-accent-foreground'
}

export default function WorkspaceList({ userId }: { userId: string }) {
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null)
  const [meta, setMeta] = useState<Record<string, WorkspaceMeta>>({})
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    fetchWorkspaces()
  }, [userId])

  async function fetchWorkspaces() {
    // Workspaces the user has *any* access to — via membership, not just
    // ownership. The old owner_id-only query meant invited members/guests
    // never saw anything on their own dashboard.
    const { data: memberships, error: membershipError } = await supabase
      .from('memberships')
      .select('workspace_id, role')
      .eq('user_id', userId)
    if (membershipError) {
      setError(membershipError.message)
      return
    }

    const roleByWorkspace = new Map<string, MemberRole>(
      ((memberships ?? []) as { workspace_id: string; role: MemberRole }[]).map((m) => [m.workspace_id, m.role])
    )
    const ids = Array.from(roleByWorkspace.keys())
    if (ids.length === 0) {
      setWorkspaces([])
      return
    }

    const { data, error } = await supabase.from('workspaces').select('id, name').in('id', ids)
    if (error) {
      setError(error.message)
      return
    }
    setWorkspaces((data ?? []) as Workspace[])

    const [{ data: boards }, { data: allMemberships }] = await Promise.all([
      supabase
        .from('boards')
        .select('id, name, workspace_id, created_at')
        .in('workspace_id', ids)
        .order('created_at', { ascending: false }),
      supabase.from('memberships').select('workspace_id').in('workspace_id', ids),
    ])

    const boardsByWorkspace: Record<string, { name: string; created_at: string }[]> = {}
    for (const b of (boards ?? []) as { id: string; name: string; workspace_id: string; created_at: string }[]) {
      ;(boardsByWorkspace[b.workspace_id] ??= []).push({ name: b.name, created_at: b.created_at })
    }
    const memberCounts: Record<string, number> = {}
    for (const m of (allMemberships ?? []) as { workspace_id: string }[]) {
      memberCounts[m.workspace_id] = (memberCounts[m.workspace_id] ?? 0) + 1
    }

    const nextMeta: Record<string, WorkspaceMeta> = {}
    for (const id of ids) {
      nextMeta[id] = {
        boardCount: boardsByWorkspace[id]?.length ?? 0,
        memberCount: memberCounts[id] ?? 0,
        latestBoardName: boardsByWorkspace[id]?.[0]?.name ?? null,
        role: roleByWorkspace.get(id) ?? 'member',
      }
    }
    setMeta(nextMeta)
  }

  async function createWorkspace(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    setError(null)
    const slug = `${name
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')}-${Math.random().toString(36).slice(2, 8)}`
    const { error } = await supabase.from('workspaces').insert({ name, slug, owner_id: userId })
    setCreating(false)
    if (error) return setError(error.message)
    setName('')
    fetchWorkspaces()
    refreshSidebar()
  }

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={createWorkspace} className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-64">
          <Field
            label="Novo workspace"
            name="workspace-name"
            placeholder="Ex.: Time de Produto"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={creating || !name.trim()}>
          <Plus size={18} weight="bold" />
          Criar
        </Button>
      </form>

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {workspaces === null ? (
        <div className="flex flex-col gap-2" aria-label="Carregando workspaces">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg border border-border bg-surface" />
          ))}
        </div>
      ) : workspaces.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-14 text-center">
          <SquaresFour size={28} className="text-muted-foreground" />
          <p className="text-sm font-medium text-primary">Nenhum workspace ainda</p>
          <p className="text-sm text-muted-foreground">Crie o primeiro acima para começar a organizar boards.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-background">
          {workspaces.map((w) => {
            const m = meta[w.id]
            const boardCount = m?.boardCount ?? 0
            return (
              <li key={w.id}>
                <Link
                  href={`/app/workspace/${w.id}`}
                  className="flex items-center gap-3.5 px-5 py-4 transition-colors hover:bg-surface"
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${monogramStyle(w.id)}`}
                    aria-hidden="true"
                  >
                    {w.name.trim().charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">{w.name}</p>
                      {m && (
                        <span className="shrink-0 rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          {roleLabel[m.role]}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 flex items-center gap-3 overflow-hidden text-xs text-muted-foreground">
                      <span className="truncate">
                        {boardCount === 0 ? 'Nenhum board' : boardCount === 1 ? '1 board' : `${boardCount} boards`}
                        {m?.latestBoardName ? ` · último: ${m.latestBoardName}` : ''}
                      </span>
                      {!!m?.memberCount && (
                        <span className="hidden shrink-0 items-center gap-1 sm:inline-flex">
                          <UsersThree size={12} />
                          {m.memberCount === 1 ? '1 membro' : `${m.memberCount} membros`}
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">Ver boards →</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
