"use client"
import { useEffect, useState } from 'react'
import { Trash, UserPlus } from '@phosphor-icons/react/dist/ssr'
import { supabase } from '../lib/supabaseClient'
import { Avatar } from './ui/Avatar'
import { Field } from './ui/Field'
import { Button } from './ui/Button'
import type { MemberRole } from '../../supabase/types'

type Member = {
  membershipId: string
  userId: string
  role: MemberRole
  name: string
  email: string
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

  const isAdmin = myRole === 'owner' || myRole === 'admin'

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
      ? await supabase.from('profiles').select('id, full_name, email').in('id', ids)
      : { data: [] as { id: string; full_name: string | null; email: string }[] }
    const profileById = new Map(
      ((profiles ?? []) as { id: string; full_name: string | null; email: string }[]).map((p) => [p.id, p])
    )

    setMembers(
      rows.map((r) => ({
        membershipId: r.id,
        userId: r.user_id,
        role: r.role,
        name: profileById.get(r.user_id)?.full_name || profileById.get(r.user_id)?.email || 'Membro',
        email: profileById.get(r.user_id)?.email ?? '',
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
    setInviting(false)
    if (error) return setError(error.message)
    setInfo(data === 'added' ? `${email} já tinha conta — adicionado direto ao workspace.` : `Convite enviado para ${email}.`)
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

  async function revokeInvite(id: string) {
    setInvites((prev) => prev.filter((i) => i.id !== id))
    const { error } = await supabase.from('workspace_invites').delete().eq('id', id)
    if (error) setError(error.message)
  }

  return (
    <div className="flex flex-col gap-8">
      {isAdmin && (
        <form onSubmit={sendInvite} className="flex flex-wrap items-end gap-3">
          <div className="w-64">
            <Field
              label="Convidar por email"
              type="email"
              name="invite-email"
              placeholder="pessoa@revollution.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Papel</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as MemberRole)}
              className="h-11 rounded-lg border border-border bg-background px-3.5 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
            >
              <option value="member">Membro</option>
              <option value="admin">Admin</option>
              <option value="guest">Convidado</option>
            </select>
          </div>
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
                <Avatar name={m.name} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{m.name}</p>
                  {m.email && <p className="truncate text-xs text-muted-foreground">{m.email}</p>}
                </div>
                {isAdmin && m.role !== 'owner' ? (
                  <select
                    value={m.role}
                    onChange={(e) => changeRole(m.membershipId, e.target.value as MemberRole)}
                    className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-accent"
                  >
                    <option value="member">Membro</option>
                    <option value="admin">Admin</option>
                    <option value="guest">Convidado</option>
                  </select>
                ) : (
                  <span className="rounded-full bg-surface px-2.5 py-1 text-xs text-muted-foreground">
                    {roleLabel[m.role]}
                  </span>
                )}
                {isAdmin && m.role !== 'owner' && m.userId !== userId && (
                  <button
                    onClick={() => removeMember(m.membershipId)}
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
                  <p className="text-xs text-muted-foreground">Aguardando cadastro</p>
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
    </div>
  )
}
