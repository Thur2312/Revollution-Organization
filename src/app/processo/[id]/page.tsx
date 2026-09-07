"use client"
import { useEffect, useState } from 'react'
import { Logo } from '../../../components/ui/Logo'
import { ProcessoInpiTipoBadge } from '../../../components/inpi/ProcessoInpiTipoBadge'
import type { EventoProcessoInpi, ProcessoInpi } from '../../../../supabase/types'

function formatDate(value: string | null | undefined) {
  if (!value) return null
  return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR')
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return null
  return new Date(value).toLocaleString('pt-BR')
}

const CAMPOS: { chave: keyof ProcessoInpi; rotulo: string }[] = [
  { chave: 'titular', rotulo: 'Titular' },
  { chave: 'apresentacao', rotulo: 'Apresentação' },
  { chave: 'natureza', rotulo: 'Natureza' },
  { chave: 'classe', rotulo: 'Classe' },
]

export default function ProcessoPublicoPage({ params }: { params: { id: string } }) {
  const [processo, setProcesso] = useState<Partial<ProcessoInpi> | null | undefined>(undefined)
  const [eventos, setEventos] = useState<Partial<EventoProcessoInpi>[]>([])

  useEffect(() => {
    fetch(`/api/publico/processo/${params.id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((body) => {
        setProcesso(body.processo)
        setEventos(body.eventos ?? [])
      })
      .catch(() => setProcesso(null))
  }, [params.id])

  return (
    <div className="min-h-dvh bg-surface">
      <header className="border-b border-border bg-background px-6 py-5">
        <div className="mx-auto max-w-2xl">
          <Logo className="h-8" />
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-10">
        {processo === undefined && <div className="h-40 animate-pulse rounded-xl border border-border bg-background" />}

        {processo === null && (
          <p className="text-sm text-muted-foreground">
            Processo não encontrado. Verifique se o link recebido por e-mail está completo.
          </p>
        )}

        {processo && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">Acompanhamento de processo</p>
              {processo.tipo && <ProcessoInpiTipoBadge tipo={processo.tipo} />}
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

            {processo.situacao && (
              <div className="mt-6 rounded-xl border border-border bg-background p-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Situação atual</p>
                <p className="mt-1 text-base font-semibold text-foreground">{processo.situacao}</p>
                {processo.despacho_descricao && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    <strong className="text-foreground">Último despacho:</strong> {processo.despacho_descricao}
                    {processo.despacho_data && <> · {formatDate(processo.despacho_data)}</>}
                  </p>
                )}
              </div>
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

            <div className="mt-6 rounded-lg border border-dashed border-border bg-background px-4 py-3 text-xs text-muted-foreground">
              Consulta de conveniência, feita direto na base pública do INPI. Para efeitos legais, a Revista da
              Propriedade Industrial (RPI) é o único canal oficial de publicação de despachos.
            </div>

            <h2 className="mt-10 text-lg font-semibold text-primary">Histórico de despachos</h2>
            {eventos.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">Nenhuma atualização registrada ainda.</p>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                {eventos.map((evento) => (
                  <div key={evento.id} className="rounded-xl border border-border bg-background p-5">
                    <p className="font-medium text-foreground">{evento.situacao ?? 'Atualização'}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{evento.despacho_descricao}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Encontrado em {formatDateTime(evento.encontrado_em)}
                      {evento.despacho_data && <> · Despacho de {formatDate(evento.despacho_data)}</>}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
