"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowsClockwise, Envelope, Plus, Stamp, Trash, Warning } from '@phosphor-icons/react/dist/ssr'
import { supabase } from '../../../../../lib/supabaseClient'
import { useAppSession } from '../../../../../lib/AppSessionContext'
import { adicionarProcessoInpi, listarProcessosInpi, removerProcessoInpi } from '../../../../../lib/inpiProcessos'
import { Field } from '../../../../../components/ui/Field'
import { Select } from '../../../../../components/ui/Select'
import { Button } from '../../../../../components/ui/Button'
import { ConfirmDialog } from '../../../../../components/ui/ConfirmDialog'
import { useToast } from '../../../../../components/ui/ToastProvider'
import { ProcessoInpiTipoBadge } from '../../../../../components/inpi/ProcessoInpiTipoBadge'
import type { ProcessoInpi, TipoProcessoInpi } from '../../../../../../supabase/types'

function formatDate(value: string | null) {
  if (!value) return null
  return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR')
}

function formatDateTime(value: string | null) {
  if (!value) return null
  return new Date(value).toLocaleString('pt-BR')
}

export default function WorkspaceProcessosPage({ params }: { params: { id: string } }) {
  const workspaceId = params.id
  const { userId } = useAppSession()
  const toast = useToast()
  const [workspaceName, setWorkspaceName] = useState<string | null>(null)
  const [processos, setProcessos] = useState<ProcessoInpi[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [numeroProcesso, setNumeroProcesso] = useState('')
  const [tipo, setTipo] = useState<TipoProcessoInpi>('marca')
  const [apelido, setApelido] = useState('')
  const [clienteNome, setClienteNome] = useState('')
  const [clienteEmail, setClienteEmail] = useState('')
  const [adding, setAdding] = useState(false)

  const [verificandoId, setVerificandoId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ProcessoInpi | null>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('workspaces').select('name').eq('id', workspaceId).single()
      setWorkspaceName((data as { name: string } | null)?.name ?? null)
    }
    load()
  }, [workspaceId])

  useEffect(() => {
    fetchProcessos()
  }, [workspaceId])

  async function fetchProcessos() {
    try {
      setProcessos(await listarProcessosInpi(workspaceId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar processos.')
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!numeroProcesso.trim() || !userId) return
    setAdding(true)
    setError(null)
    try {
      await adicionarProcessoInpi({
        workspaceId,
        userId,
        numeroProcesso,
        tipo,
        apelido: apelido || null,
        clienteNome: clienteNome || null,
        clienteEmail: clienteEmail || null,
      })
      setNumeroProcesso('')
      setApelido('')
      setTipo('marca')
      setClienteNome('')
      setClienteEmail('')
      await fetchProcessos()
      toast('Processo adicionado — a primeira verificação roda em instantes.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao adicionar processo.')
    } finally {
      setAdding(false)
    }
  }

  async function handleVerificar(processo: ProcessoInpi) {
    setVerificandoId(processo.id)
    setError(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) throw new Error('Sessão expirada — atualize a página.')

      const res = await fetch('/api/inpi/verificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ processoId: processo.id }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'Falha ao verificar no INPI.')

      await fetchProcessos()
      if (!body.mudou) {
        toast('Verificado — sem mudanças desde a última checagem.')
      } else if (body.emailEnviado) {
        toast('Encontramos uma atualização — e-mail enviado ao cliente.')
      } else {
        toast('Encontramos uma atualização nesse processo.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao verificar no INPI.')
    } finally {
      setVerificandoId(null)
    }
  }

  async function handleDelete(processo: ProcessoInpi) {
    setProcessos((prev) => (prev ? prev.filter((p) => p.id !== processo.id) : prev))
    try {
      await removerProcessoInpi(processo.id)
      toast(`Processo ${processo.numero_processo} removido.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao remover processo.')
      fetchProcessos()
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      {workspaceName && (
        <p className="mb-1 text-sm text-muted-foreground">
          <Link href={`/app/workspace/${workspaceId}`} className="hover:text-primary">
            {workspaceName}
          </Link>{' '}
          /
        </p>
      )}
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-primary">Processos</h1>
      <p className="max-w-2xl text-sm text-muted-foreground">
        Cadastre o número de um processo de marca, patente ou desenho industrial já depositado no INPI. Verificamos a
        base pública do INPI automaticamente todo dia e avisamos o cliente por e-mail quando o status ou o despacho
        mudar — clique em &quot;Verificar agora&quot; pra checar na hora, sem esperar a próxima rodada automática.
      </p>
      <div className="mt-3 max-w-2xl rounded-lg border border-dashed border-border bg-surface px-4 py-3 text-xs text-muted-foreground">
        Consulta de conveniência, feita direto na base pública do INPI. Para efeitos legais, a Revista da Propriedade
        Industrial (RPI) é o único canal oficial de publicação de despachos.
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <form onSubmit={handleAdd} className="mt-6 rounded-xl border border-border bg-background p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Número do processo"
            name="numero_processo"
            placeholder="Ex.: 823767730"
            value={numeroProcesso}
            onChange={(e) => setNumeroProcesso(e.target.value)}
            required
          />
          <Select label="Tipo" name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoProcessoInpi)}>
            <option value="marca">Marca</option>
            <option value="patente">Patente</option>
            <option value="desenho_industrial">Desenho industrial</option>
          </Select>
          <Field
            label="Apelido (opcional)"
            name="apelido"
            placeholder="Ex.: Logo da marca X"
            value={apelido}
            onChange={(e) => setApelido(e.target.value)}
          />
        </div>

        <p className="mb-1.5 mt-5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Aviso de atualização (opcional)
        </p>
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field
            label="Nome do cliente"
            name="cliente_nome"
            placeholder="Ex.: Maria Souza"
            value={clienteNome}
            onChange={(e) => setClienteNome(e.target.value)}
          />
          <Field
            label="E-mail do cliente"
            name="cliente_email"
            type="email"
            placeholder="cliente@exemplo.com"
            value={clienteEmail}
            onChange={(e) => setClienteEmail(e.target.value)}
          />
          <Button type="submit" disabled={adding || !numeroProcesso.trim()}>
            <Plus size={18} weight="bold" />
            Adicionar
          </Button>
        </div>
      </form>

      {processos === null ? (
        <div className="mt-8 flex flex-col gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-surface" />
          ))}
        </div>
      ) : processos.length === 0 ? (
        <div className="mt-8 flex items-start gap-3 rounded-xl border border-dashed border-border px-5 py-6">
          <Stamp size={22} className="mt-0.5 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nenhum processo cadastrado ainda. Adicione um número de processo acima para começar a acompanhar.
          </p>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-3">
          {processos.map((processo) => (
            <div
              key={processo.id}
              className="flex flex-col gap-4 rounded-xl border border-border bg-background p-5 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-foreground">
                    {processo.apelido || processo.nome || processo.numero_processo}
                  </p>
                  <ProcessoInpiTipoBadge tipo={processo.tipo} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Processo <strong className="text-foreground">{processo.numero_processo}</strong>
                  {processo.situacao && (
                    <>
                      {' '}
                      · <strong className="text-foreground">{processo.situacao}</strong>
                    </>
                  )}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {processo.ultima_verificacao_em
                    ? `Verificado em ${formatDateTime(processo.ultima_verificacao_em)}`
                    : 'Ainda não verificado — clique em "Verificar agora".'}
                  {processo.despacho_data && <> · Último despacho em {formatDate(processo.despacho_data)}</>}
                </p>
                {processo.cliente_email && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Envelope size={12} />
                    Aviso para {processo.cliente_nome ? `${processo.cliente_nome} · ` : ''}
                    {processo.cliente_email}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={verificandoId === processo.id}
                  onClick={() => handleVerificar(processo)}
                >
                  <ArrowsClockwise size={14} className={verificandoId === processo.id ? 'animate-spin' : ''} />
                  {verificandoId === processo.id ? 'Verificando…' : 'Verificar agora'}
                </Button>
                <Link href={`/app/workspace/${workspaceId}/processos/${processo.id}`}>
                  <Button type="button" variant="ghost" size="sm">
                    Ver histórico
                  </Button>
                </Link>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setPendingDelete(processo)}
                >
                  <Trash size={14} />
                  Remover
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={`Remover o processo "${pendingDelete.apelido || pendingDelete.numero_processo}"?`}
          description="O histórico de despachos desse processo também será removido. Essa ação não pode ser desfeita."
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            handleDelete(pendingDelete)
            setPendingDelete(null)
          }}
        />
      )}

      <p className="mt-8 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Warning size={13} />
        Checagem automática roda uma vez por dia para processos não verificados há mais de 7 dias (a RPI é publicada
        semanalmente) — use &quot;Verificar agora&quot; pra checar antes disso.
      </p>
    </div>
  )
}
