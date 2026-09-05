"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CaretLeft, PencilSimple, Scroll } from '@phosphor-icons/react/dist/ssr'
import { supabase } from '../../../../../../lib/supabaseClient'
import { useAppSession } from '../../../../../../lib/AppSessionContext'
import { marcarEventoInpiLido, vincularClienteProcessoInpi } from '../../../../../../lib/inpiProcessos'
import { atualizarCliente, criarCliente, listarClientes, type CadastroCliente } from '../../../../../../lib/clientes'
import { Button } from '../../../../../../components/ui/Button'
import { Field } from '../../../../../../components/ui/Field'
import { ProcessoInpiTipoBadge } from '../../../../../../components/inpi/ProcessoInpiTipoBadge'
import {
  CLIENTE_NENHUM,
  CLIENTE_NOVO,
  ClienteFieldset,
  novoClienteVazio,
  type NovoClienteState,
} from '../../../../../../components/inpi/ClienteFieldset'
import type { Cliente, EventoProcessoInpi, ProcessoInpi, ProcessoInpiComCliente } from '../../../../../../../supabase/types'

function formatDate(value: string | null) {
  if (!value) return null
  return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR')
}

function formatDateTime(value: string | null) {
  if (!value) return null
  return new Date(value).toLocaleString('pt-BR')
}

const CAMPOS: { chave: keyof ProcessoInpi; rotulo: string }[] = [
  { chave: 'situacao', rotulo: 'Situação' },
  { chave: 'titular', rotulo: 'Titular' },
  { chave: 'apresentacao', rotulo: 'Apresentação' },
  { chave: 'natureza', rotulo: 'Natureza' },
  { chave: 'classe', rotulo: 'Classe' },
]

function cadastroDeCliente(cliente: Cliente | null): NovoClienteState {
  return {
    nome: cliente?.nome ?? '',
    email: cliente?.email ?? '',
    documento: cliente?.documento ?? '',
    telefone: cliente?.telefone ?? '',
    observacoes: cliente?.observacoes ?? '',
  }
}

export default function ProcessoInpiDetailPage({ params }: { params: { id: string; processoId: string } }) {
  const workspaceId = params.id
  const processoId = params.processoId
  const { userId } = useAppSession()
  const [processo, setProcesso] = useState<ProcessoInpiComCliente | null | undefined>(undefined)
  const [eventos, setEventos] = useState<EventoProcessoInpi[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [error, setError] = useState<string | null>(null)

  const [editandoCadastro, setEditandoCadastro] = useState(false)
  const [cadastroEdit, setCadastroEdit] = useState<NovoClienteState>(novoClienteVazio())
  const [salvandoCadastro, setSalvandoCadastro] = useState(false)

  const [trocandoCliente, setTrocandoCliente] = useState(false)
  const [clienteSelecionadoId, setClienteSelecionadoId] = useState(CLIENTE_NENHUM)
  const [novoCliente, setNovoCliente] = useState<NovoClienteState>(novoClienteVazio())
  const [salvandoTroca, setSalvandoTroca] = useState(false)

  useEffect(() => {
    load()
    listarClientes(workspaceId)
      .then(setClientes)
      .catch((e) => setError(e instanceof Error ? e.message : 'Falha ao carregar clientes.'))
  }, [processoId, workspaceId])

  async function load() {
    const { data: p } = await supabase
      .from('processos_inpi')
      .select('*, cliente:clientes(*)')
      .eq('id', processoId)
      .maybeSingle()
    setProcesso((p as unknown as ProcessoInpiComCliente | null) ?? null)

    const { data: ev } = await supabase
      .from('eventos_processo_inpi')
      .select('*')
      .eq('processo_id', processoId)
      .order('encontrado_em', { ascending: false })
    setEventos((ev ?? []) as EventoProcessoInpi[])
  }

  async function handleMarcarLido(eventoId: string) {
    setEventos((prev) => prev.map((e) => (e.id === eventoId ? { ...e, lido: true } : e)))
    try {
      await marcarEventoInpiLido(eventoId)
    } catch {
      load()
    }
  }

  function abrirEdicaoCadastro() {
    setCadastroEdit(cadastroDeCliente(processo?.cliente ?? null))
    setEditandoCadastro(true)
  }

  async function salvarCadastroCliente() {
    if (!processo?.cliente) return
    setSalvandoCadastro(true)
    setError(null)
    try {
      await atualizarCliente(processo.cliente.id, cadastroEdit as CadastroCliente)
      setEditandoCadastro(false)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar o cadastro do cliente.')
    } finally {
      setSalvandoCadastro(false)
    }
  }

  function abrirTrocaCliente() {
    setClienteSelecionadoId(processo?.cliente_id ?? CLIENTE_NENHUM)
    setNovoCliente(novoClienteVazio())
    setTrocandoCliente(true)
  }

  async function salvarTrocaCliente() {
    if (!userId) return
    setSalvandoTroca(true)
    setError(null)
    try {
      let clienteId: string | null = null
      if (clienteSelecionadoId === CLIENTE_NOVO) {
        const criado = await criarCliente(workspaceId, userId, novoCliente as CadastroCliente)
        clienteId = criado?.id ?? null
      } else if (clienteSelecionadoId) {
        clienteId = clienteSelecionadoId
      }
      await vincularClienteProcessoInpi(processoId, clienteId)
      setTrocandoCliente(false)
      await Promise.all([
        load(),
        listarClientes(workspaceId).then(setClientes),
      ])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao vincular o cliente.')
    } finally {
      setSalvandoTroca(false)
    }
  }

  if (processo === undefined) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="h-40 animate-pulse rounded-xl border border-border bg-surface" />
      </div>
    )
  }

  if (processo === null) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <p className="text-sm text-muted-foreground">Processo não encontrado.</p>
        <Link href={`/app/workspace/${workspaceId}/processos`} className="mt-2 inline-block text-sm text-accent hover:underline">
          Voltar para Processos
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link
        href={`/app/workspace/${workspaceId}/processos`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
      >
        <CaretLeft size={14} weight="bold" />
        Processos
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">Processo do INPI</p>
        <ProcessoInpiTipoBadge tipo={processo.tipo} />
      </div>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-primary">
        {processo.apelido || processo.nome || processo.numero_processo}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Processo <strong className="text-foreground">{processo.numero_processo}</strong>
        {processo.nome && processo.apelido && (
          <>
            {' '}
            · <strong className="text-foreground">{processo.nome}</strong>
          </>
        )}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {processo.ultima_verificacao_em
          ? `Última verificação em ${formatDateTime(processo.ultima_verificacao_em)}`
          : 'Ainda não verificado.'}
        {processo.numero_rpi && <> · Nº da Revista {processo.numero_rpi}</>}
      </p>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {CAMPOS.some((campo) => processo[campo.chave]) && (
        <dl className="mt-6 grid gap-4 rounded-xl border border-border bg-background p-5 sm:grid-cols-2">
          {CAMPOS.filter((campo) => processo[campo.chave]).map((campo) => (
            <div key={campo.chave}>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">{campo.rotulo}</dt>
              <dd className="mt-0.5 text-sm text-foreground">{processo[campo.chave] as string}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-6 rounded-xl border border-border bg-background p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Cliente</h2>
          {!trocandoCliente && (
            <button type="button" onClick={abrirTrocaCliente} className="text-xs text-accent hover:underline">
              {processo.cliente ? 'Trocar cliente' : 'Vincular cliente'}
            </button>
          )}
        </div>

        {trocandoCliente ? (
          <div className="mt-4">
            <ClienteFieldset
              clientes={clientes}
              selectedId={clienteSelecionadoId}
              onSelectedIdChange={setClienteSelecionadoId}
              novo={novoCliente}
              onNovoChange={setNovoCliente}
            />
            <div className="mt-4 flex gap-2">
              <Button type="button" size="sm" onClick={salvarTrocaCliente} disabled={salvandoTroca}>
                {salvandoTroca ? 'Salvando…' : 'Salvar'}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setTrocandoCliente(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : !processo.cliente ? (
          <p className="mt-2 text-sm text-muted-foreground">Nenhum cliente vinculado a esse processo.</p>
        ) : editandoCadastro ? (
          <div className="mt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Nome"
                value={cadastroEdit.nome}
                onChange={(e) => setCadastroEdit({ ...cadastroEdit, nome: e.target.value })}
              />
              <Field
                label="E-mail"
                type="email"
                value={cadastroEdit.email}
                onChange={(e) => setCadastroEdit({ ...cadastroEdit, email: e.target.value })}
              />
              <Field
                label="CPF/CNPJ"
                value={cadastroEdit.documento}
                onChange={(e) => setCadastroEdit({ ...cadastroEdit, documento: e.target.value })}
              />
              <Field
                label="Telefone/WhatsApp"
                value={cadastroEdit.telefone}
                onChange={(e) => setCadastroEdit({ ...cadastroEdit, telefone: e.target.value })}
              />
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-sm font-medium text-foreground">Observações</label>
                <textarea
                  value={cadastroEdit.observacoes}
                  onChange={(e) => setCadastroEdit({ ...cadastroEdit, observacoes: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-accent"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button type="button" size="sm" onClick={salvarCadastroCliente} disabled={salvandoCadastro}>
                {salvandoCadastro ? 'Salvando…' : 'Salvar'}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditandoCadastro(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-3">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Nome</dt>
                <dd className="mt-0.5 text-sm text-foreground">{processo.cliente.nome || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">E-mail</dt>
                <dd className="mt-0.5 text-sm text-foreground">{processo.cliente.email || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">CPF/CNPJ</dt>
                <dd className="mt-0.5 text-sm text-foreground">{processo.cliente.documento || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Telefone</dt>
                <dd className="mt-0.5 text-sm text-foreground">{processo.cliente.telefone || '—'}</dd>
              </div>
              {processo.cliente.observacoes && (
                <div className="sm:col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Observações</dt>
                  <dd className="mt-0.5 text-sm text-foreground">{processo.cliente.observacoes}</dd>
                </div>
              )}
            </dl>
            <button
              type="button"
              onClick={abrirEdicaoCadastro}
              className="mt-3 inline-flex items-center gap-1 text-xs text-accent hover:underline"
            >
              <PencilSimple size={12} />
              Editar cadastro
            </button>
          </div>
        )}
      </div>

      <div className="mt-2 max-w-2xl rounded-lg border border-dashed border-border bg-surface px-4 py-3 text-xs text-muted-foreground">
        Consulta de conveniência, feita direto na base pública do INPI. Para efeitos legais, a Revista da Propriedade
        Industrial (RPI) é o único canal oficial de publicação de despachos.
      </div>

      <h2 className="mt-10 text-lg font-semibold text-primary">Histórico de despachos</h2>
      {eventos.length === 0 ? (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-dashed border-border px-5 py-6">
          <Scroll size={22} className="mt-0.5 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nenhuma atualização registrada ainda. Assim que uma mudança de status ou despacho for encontrada, ela
            aparece aqui.
          </p>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {eventos.map((evento) => (
            <div key={evento.id} className="rounded-xl border border-border bg-background p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-foreground">{evento.situacao ?? 'Atualização'}</p>
                {!evento.lido && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => handleMarcarLido(evento.id)}>
                    Marcar como lido
                  </Button>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{evento.despacho_descricao}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Encontrado em {formatDateTime(evento.encontrado_em)}
                {evento.despacho_data && <> · Despacho de {formatDate(evento.despacho_data)}</>}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
