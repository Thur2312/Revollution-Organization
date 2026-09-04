"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CaretLeft, Scroll } from '@phosphor-icons/react/dist/ssr'
import { supabase } from '../../../../../../lib/supabaseClient'
import { marcarEventoInpiLido } from '../../../../../../lib/inpiProcessos'
import { Button } from '../../../../../../components/ui/Button'
import { ProcessoInpiTipoBadge } from '../../../../../../components/inpi/ProcessoInpiTipoBadge'
import type { EventoProcessoInpi, ProcessoInpi } from '../../../../../../../supabase/types'

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

export default function ProcessoInpiDetailPage({ params }: { params: { id: string; processoId: string } }) {
  const workspaceId = params.id
  const processoId = params.processoId
  const [processo, setProcesso] = useState<ProcessoInpi | null | undefined>(undefined)
  const [eventos, setEventos] = useState<EventoProcessoInpi[]>([])

  useEffect(() => {
    load()
  }, [processoId])

  async function load() {
    const { data: p } = await supabase.from('processos_inpi').select('*').eq('id', processoId).maybeSingle()
    setProcesso((p as ProcessoInpi | null) ?? null)

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
      {processo.cliente_email && (
        <p className="mt-1 text-xs text-muted-foreground">
          Aviso de atualização para {processo.cliente_nome ? `${processo.cliente_nome} · ` : ''}
          {processo.cliente_email}
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
