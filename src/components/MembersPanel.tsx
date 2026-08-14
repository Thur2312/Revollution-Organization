"use client"
import { useEffect, useRef, useState } from 'react'
import { Trash, UserPlus } from '@phosphor-icons/react/dist/ssr'
import { supabase } from '../lib/supabaseClient'
import { Avatar } from './ui/Avatar'
import { Field } from './ui/Field'
import { Select } from './ui/Select'
import { Button } from './ui/Button'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { useToast } from './ui/ToastProvider'
import type { MemberRole, UserSearchResult } from '../../supabase/types'

type Member = {
  membershipId: string
  userId: string
  role: MemberRole
  name: string
  email: string
  avatarUrl: string | null
}

type PendingInvite = {
  id: string
  email: string
  role: MemberRole
  createdAt: string
}

const roleLabel: Record<MemberRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Membro',
  guest: 'Convidado',
}

export function MembersPanel({ workspaceId, userId }: { workspaceId: string; userId: string }) {
  const [members, setMembers] = useState<Member[] | null>(null)
  const [invites, setInvites] = useState<PendingInvite[]>([])
  const [myRole, setMyRole] = useState<MemberRole | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<MemberRole>('member')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [pendingRemove, setPendingRemove] = useState<Member | null>(null)
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const searchBoxRef = useRef<HTMLDivElement>(null)

  const isAdmin = myRole === 'owner' || myRole === 'admin'
  const toast = useToast()

  useEffect(() => {
    const query = inviteEmail.trim()
    if (query.length < 3) {
      setSearchResults([])
      return
    }
    const handle = setTimeout(async () => {
      const { data } = await supabase.rpc('search_users_by_email', { p_query: query })
      setSearchResults((data as UserSearchResult[]) ?? [])
    }, 250)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteEmail])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) setShowResults(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, userId])

  async function fetchAll() {
    const { data: mine } = await supabase
      .from('memberships')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .single()
    setMyRole(((mine as { role: MemberRole } | null)?.role) ?? null)

    const { data: memberships, error: mErr } = await supabase
      .from('memberships')
      .select('id, user_id, role')
      .eq('workspace_id', workspaceId)
    if (mErr) return setError(mErr.message)

    const rows = (memberships ?? []) as { id: string; user_id: string; role: MemberRole }[]
    const ids = rows.map((r) => r.user_id)
    const { data: profiles } = ids.length
      ? await supabase.from('profiles').select('id, full_name, email, avatar_url').in('id', ids)
      : { data: [] as { id: string; full_name: string | null; email: string; avatar_url: string | null }[] }
    const profileById = new Map(
      ((profiles ?? []) as { id: string; full_name: string | null; email: string; avatar_url: string | null }[]).map(
        (p) => [p.id, p]
      )
    )

    setMembers(
      rows.map((r) => ({
        membershipId: r.id,
        userId: r.user_id,
        role: r.role,
        name: profileById.get(r.user_id)?.full_name || profileById.get(r.user_id)?.email || 'Membro',
        email: profileById.get(r.user_id)?.email ?? '',
        avatarUrl: profileById.get(r.user_id)?.avatar_url ?? null,
      }))
    )

    const { data: pending } = await supabase
      .from('workspace_invites')
      .select('id, email, role, created_at')
      .eq('workspace_id', workspaceId)
      .is('accepted_at', null)
    setInvites(
      ((pending ?? []) as { id: string; email: string; role: MemberRole; created_at: string }[]).map((p) => ({
        id: p.id,
        email: p.email,
        role: p.role,
        createdAt: p.created_at,
      }))
    )
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault()
    const email = inviteEmail.trim().toLowerCase()
    if (!email) return
    setInviting(true)
    setError(null)
    setInfo(null)
    const { data, error } = await supabase.rpc('invite_member', {
      p_workspace_id: workspaceId,
      p_email: email,
      p_role: inviteRole,
    })
    if (error) {
      setInviting(false)
      return setError(error.message)
    }

    if (data === 'existing') {
      setInviting(false)
      setInfo(`Convite enviado — ${email} já tem conta e vai ver o pedido na caixa de entrada dele(a).`)
      setInviteEmail('')
      fetchAll()
      return
    }

    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData.session?.access_token
    if (!accessToken) {
      setInviting(false)
      setError('Convite registrado, mas não foi possível enviar o email (sessão expirada).')
      fetchAll()
      return
    }

    const res = await fetch('/api/invites/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ workspaceId, email }),
    })
    setInviting(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(`Convite registrado, mas o email falhou: ${body.error ?? res.statusText}`)
    } else {
      setInfo(`Convite enviado para ${email}.`)
    }
    setInviteEmail('')
    fetchAll()
  }

  async function changeRole(membershipId: string, role: MemberRole) {
    setMembers((prev) => (prev ? prev.map((m) => (m.membershipId === membershipId ? { ...m, role } : m)) : prev))
    const { error } = await supabase.from('memberships').update({ role }).eq('id', membershipId)
    if (error) setError(error.message)
  }

  async function removeMember(membershipId: string) {
    setMembers((prev) => (prev ? prev.filter((m) => m.membershipId !== membershipId) : prev))
    const { error } = await supabase.from('memberships').delete().eq('id', membershipId)
    if (error) setError(error.message)
  }

  function requestRemoveMember(membershipId: string) {
    const member = members?.find((m) => m.membershipId === membershipId) ?? null
    setPendingRemove(member)
  }

  async function revokeInvite(id: string) {
    setInvites((prev) => prev.filter((i) => i.id !== id))
    const { error } = await supabase.from('workspace_invites').delete().eq('id', id)
    if (error) setError(error.message)
    else toast('Convite cancelado.')
  }

  return (
    <div className="flex flex-col gap-8">
      {isAdmin && (
        <form onSubmit={sendInvite} className="flex flex-wrap items-end gap-3">
          <div ref={searchBoxRef} className="relative w-full sm:w-64">
            <Field
              label="Convidar por email"
              type="email"
              name="invite-email"
              placeholder="Busque por nome ou email…"
              autoComplete="off"
              value={inviteEmail}
              onChange={(e) => {
                setInviteEmail(e.target.value)
                setShowResults(true)
              }}
              onFocus={() => setShowResults(true)}
            />
            {showResults && searchResults.length > 0 && (
              <div
                className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-background py-1 shadow-lg"
                style={{ animation: 'dropdown-in 150ms ease-out' }}
              >
                {searchResults.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setInviteEmail(u.email)
                      setShowResults(false)
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-surface"
                  >
                    <Avatar name={u.full_name || u.email} imageUrl={u.avatar_url} size={26} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-foreground">{u.full_name || u.email}</span>
                      {u.full_name && <span className="block truncate text-xs text-muted-foreground">{u.email}</span>}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Select label="Papel" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as MemberRole)}>
            <option value="member">Membro</option>
            <option value="admin">Admin</option>
            <option value="guest">Convidado</option>
          </Select>
          <Button type="submit" disabled={inviting || !inviteEmail.trim()}>
            <UserPlus size={18} weight="bold" />
            Convidar
          </Button>
        </form>
      )}

      {info && (
        <p role="status" className="rounded-lg bg-accent/10 px-3 py-2 text-sm text-accent">
          {info}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div>
        <h2 className="mb-3 text-sm font-medium text-primary">Membros</h2>
        {members === null ? (
          <div className="flex flex-col gap-2" aria-label="Carregando membros">
            {[0, 1].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg border border-border bg-background" />
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-background">
            {members.map((m) => (
              <li key={m.membershipId} className="flex items-center gap-3.5 px-5 py-3.5">
                <Avatar name={m.name} imageUrl={m.avatarUrl} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{m.name}</p>
                  {m.email && <p className="truncate text-xs text-muted-foreground">{m.email}</p>}
                </div>
                {isAdmin && m.role !== 'owner' ? (
                  <Select
                    size="sm"
                    className="w-auto"
                    value={m.role}
                    onChange={(e) => changeRole(m.membershipId, e.target.value as MemberRole)}
                  >
                    <option value="member">Membro</option>
                    <option value="admin">Admin</option>
                    <option value="guest">Convidado</option>
                  </Select>
                ) : (
                  <span className="rounded-full bg-surface px-2.5 py-1 text-xs text-muted-foreground">
                    {roleLabel[m.role]}
                  </span>
                )}
                {isAdmin && m.role !== 'owner' && m.userId !== userId && (
                  <button
                    onClick={() => requestRemoveMember(m.membershipId)}
                    aria-label={`Remover ${m.name}`}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash size={16} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {isAdmin && invites.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-primary">Convites pendentes</h2>
          <ul className="divide-y divide-border rounded-xl border border-border bg-background">
            {invites.map((inv) => (
              <li key={inv.id} className="flex items-center gap-3.5 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{inv.email}</p>
                  <p className="text-xs text-muted-foreground">Aguardando aceite</p>
                </div>
                <span className="rounded-full bg-surface px-2.5 py-1 text-xs text-muted-foreground">
                  {roleLabel[inv.role]}
                </span>
                <button
                  onClick={() => revokeInvite(inv.id)}
                  aria-label={`Cancelar convite de ${inv.email}`}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash size={16} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pendingRemove && (
        <ConfirmDialog
          title={`Remover ${pendingRemove.name} do workspace?`}
          description="A pessoa perde acesso a todos os boards deste workspace imediatamente."
          confirmLabel="Remover"
          onCancel={() => setPendingRemove(null)}
          onConfirm={() => {
            removeMember(pendingRemove.membershipId)
            toast(`${pendingRemove.name} removido(a) do workspace.`)
            setPendingRemove(null)
          }}
        />
      )}
    </div>
  )
}
