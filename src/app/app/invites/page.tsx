"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Envelope } from '@phosphor-icons/react/dist/ssr'
import { supabase } from '../../../lib/supabaseClient'
import { refreshSidebar } from '../../../lib/sidebarRefresh'
import { Button } from '../../../components/ui/Button'
import { useToast } from '../../../components/ui/ToastProvider'
import type { PendingInviteRow, MemberRole } from '../../../../supabase/types'

const roleLabel: Record<MemberRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Membro',
  guest: 'Convidado',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function InvitesPage() {
  const [invites, setInvites] = useState<PendingInviteRow[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const toast = useToast()

  useEffect(() => {
    fetchInvites()
  }, [])

  async function fetchInvites() {
    const { data, error } = await supabase.rpc('my_pending_invites')
    if (error) return setError(error.message)
    setInvites((data as PendingInviteRow[]) ?? [])
  }

  async function accept(invite: PendingInviteRow) {
    setBusyId(invite.id)
    setError(null)
    const { data, error } = await supabase.rpc('accept_workspace_invite', { p_invite_id: invite.id })
    setBusyId(null)
    if (error) return setError(error.message)
    setInvites((prev) => (prev ? prev.filter((i) => i.id !== invite.id) : prev))
    refreshSidebar()
    toast(`Você entrou em ${invite.workspace_name}.`)
    router.push(`/app/workspace/${data}`)
  }

  async function decline(invite: PendingInviteRow) {
    setBusyId(invite.id)
    setError(null)
    const { error } = await supabase.rpc('decline_workspace_invite', { p_invite_id: invite.id })
    setBusyId(null)
    if (error) return setError(error.message)
    setInvites((prev) => (prev ? prev.filter((i) => i.id !== invite.id) : prev))
    toast(`Convite para ${invite.workspace_name} recusado.`, 'info')
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-primary">Convites</h1>
      <p className="mb-8 text-sm text-muted-foreground">Workspaces que te convidaram e ainda esperam sua resposta.</p>

      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {invites === null ? (
        <div className="flex flex-col gap-2" aria-label="Carregando convites">
          {[0, 1].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-border bg-background" />
          ))}
        </div>
      ) : invites.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-14 text-center">
          <Envelope size={28} className="text-muted-foreground" />
          <p className="text-sm font-medium text-primary">Nenhum convite pendente</p>
          <p className="text-sm text-muted-foreground">Quando alguém te convidar para um workspace, aparece aqui.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {invites.map((inv) => (
            <li
              key={inv.id}
              className="flex flex-wrap items-center gap-3.5 rounded-xl border border-border bg-background p-5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  <span className="font-semibold">{inv.invited_by_name}</span> te convidou para{' '}
                  <span className="font-semibold">{inv.workspace_name}</span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Como {roleLabel[inv.role]} · {formatDate(inv.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" disabled={busyId === inv.id} onClick={() => decline(inv)}>
                  Recusar
                </Button>
                <Button size="sm" disabled={busyId === inv.id} onClick={() => accept(inv)}>
                  Aceitar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
