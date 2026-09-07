"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FloppyDisk, PaperPlaneTilt } from '@phosphor-icons/react/dist/ssr'
import { supabase } from '../../../../../lib/supabaseClient'
import { useAppSession } from '../../../../../lib/AppSessionContext'
import { obterTemplateProspeccao, salvarTemplateProspeccao } from '../../../../../lib/emailTemplates'
import { listarClientes } from '../../../../../lib/clientes'
import { substituirVariaveis } from '../../../../../lib/prospeccao/emailTemplate'
import { Field } from '../../../../../components/ui/Field'
import { Select } from '../../../../../components/ui/Select'
import { Button } from '../../../../../components/ui/Button'
import { useToast } from '../../../../../components/ui/ToastProvider'
import type { Cliente } from '../../../../../../supabase/types'

const DESTINATARIO_MANUAL = '__manual__'

export default function WorkspaceEmailsPage({ params }: { params: { id: string } }) {
  const workspaceId = params.id
  const { userId } = useAppSession()
  const toast = useToast()
  const [workspaceName, setWorkspaceName] = useState<string | null>(null)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [error, setError] = useState<string | null>(null)

  const [assunto, setAssunto] = useState('')
  const [corpo, setCorpo] = useState('')
  const [templateCarregado, setTemplateCarregado] = useState(false)
  const [salvandoTemplate, setSalvandoTemplate] = useState(false)

  const [destinatarioId, setDestinatarioId] = useState(DESTINATARIO_MANUAL)
  const [nomeManual, setNomeManual] = useState('')
  const [emailManual, setEmailManual] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('workspaces').select('name').eq('id', workspaceId).single()
      setWorkspaceName((data as { name: string } | null)?.name ?? null)
    }
    load()
  }, [workspaceId])

  useEffect(() => {
    obterTemplateProspeccao(workspaceId)
      .then((template) => {
        if (template) {
          setAssunto(template.assunto)
          setCorpo(template.corpo)
        }
        setTemplateCarregado(true)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Falha ao carregar o modelo de e-mail.'))

    listarClientes(workspaceId)
      .then(setClientes)
      .catch((e) => setError(e instanceof Error ? e.message : 'Falha ao carregar clientes.'))
  }, [workspaceId])

  async function handleSalvarTemplate() {
    if (!userId) return
    setSalvandoTemplate(true)
    setError(null)
    try {
      await salvarTemplateProspeccao(workspaceId, userId, { assunto, corpo })
      toast('Modelo de e-mail salvo.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar o modelo.')
    } finally {
      setSalvandoTemplate(false)
    }
  }

  const clienteSelecionado = clientes.find((c) => c.id === destinatarioId) ?? null
  const nomeDestinatario = destinatarioId === DESTINATARIO_MANUAL ? nomeManual : clienteSelecionado?.nome ?? ''
  const emailDestinatario = destinatarioId === DESTINATARIO_MANUAL ? emailManual : clienteSelecionado?.email ?? ''

  const assuntoPreview = substituirVariaveis(assunto, { nome: nomeDestinatario })
  const corpoPreview = substituirVariaveis(corpo, { nome: nomeDestinatario })

  async function handleEnviar() {
    if (!emailDestinatario.trim() || !assunto.trim() || !corpo.trim()) return
    setEnviando(true)
    setError(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) throw new Error('Sessão expirada — atualize a página.')

      const res = await fetch('/api/emails/enviar-prospeccao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          workspaceId,
          destinatarioEmail: emailDestinatario.trim(),
          assunto: assuntoPreview,
          corpo: corpoPreview,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'Falha ao enviar o e-mail.')

      toast(`E-mail enviado para ${emailDestinatario}.`)
      if (destinatarioId === DESTINATARIO_MANUAL) {
        setNomeManual('')
        setEmailManual('')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao enviar o e-mail.')
    } finally {
      setEnviando(false)
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
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-primary">Prospecção</h1>
      <p className="max-w-2xl text-sm text-muted-foreground">
        Monte o modelo de e-mail usado pra prospectar clientes e mande pra quem quiser — de um cliente já cadastrado
        ou digitando o contato na hora. Use <code className="rounded bg-surface px-1 py-0.5">{'{{nome}}'}</code> no
        modelo pra personalizar automaticamente com o nome do destinatário.
      </p>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="mt-6 rounded-xl border border-border bg-background p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Modelo de e-mail</h2>
        <div className="mt-4 flex flex-col gap-4">
          <Field
            label="Assunto"
            placeholder="Ex.: {{nome}}, vamos proteger sua marca?"
            value={assunto}
            onChange={(e) => setAssunto(e.target.value)}
            disabled={!templateCarregado}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Corpo</label>
            <textarea
              value={corpo}
              onChange={(e) => setCorpo(e.target.value)}
              disabled={!templateCarregado}
              rows={8}
              placeholder={
                'Olá, {{nome}}!\n\nVocê sabia que registrar sua marca no INPI evita que outra empresa registre igual e te impeça de usar o próprio nome?\n\n...'
              }
              className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-accent disabled:cursor-not-allowed disabled:bg-surface"
            />
          </div>
          <Button
            type="button"
            size="sm"
            className="self-start"
            onClick={handleSalvarTemplate}
            disabled={salvandoTemplate || !templateCarregado}
          >
            <FloppyDisk size={14} weight="bold" />
            {salvandoTemplate ? 'Salvando…' : 'Salvar modelo'}
          </Button>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-background p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Enviar</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Select
            label="Destinatário"
            value={destinatarioId}
            onChange={(e) => setDestinatarioId(e.target.value)}
          >
            <option value={DESTINATARIO_MANUAL}>Digitar manualmente</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome || c.email || 'Cliente sem nome'}
              </option>
            ))}
          </Select>
          {destinatarioId === DESTINATARIO_MANUAL ? (
            <div className="grid gap-4 sm:col-span-1 sm:grid-cols-2">
              <Field label="Nome" value={nomeManual} onChange={(e) => setNomeManual(e.target.value)} placeholder="Ex.: Maria Souza" />
              <Field
                label="E-mail"
                type="email"
                value={emailManual}
                onChange={(e) => setEmailManual(e.target.value)}
                placeholder="contato@exemplo.com"
              />
            </div>
          ) : (
            <div className="flex flex-col justify-end text-sm text-muted-foreground">
              {clienteSelecionado?.email ? (
                <span>Vai para {clienteSelecionado.email}</span>
              ) : (
                <span className="text-destructive">Esse cliente não tem e-mail cadastrado.</span>
              )}
            </div>
          )}
        </div>

        {(assuntoPreview || corpoPreview) && (
          <div className="mt-4 rounded-lg border border-dashed border-border bg-surface p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Prévia</p>
            <p className="mt-1 text-sm font-medium text-foreground">{assuntoPreview || '(sem assunto)'}</p>
            <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{corpoPreview || '(sem corpo)'}</p>
          </div>
        )}

        <Button
          type="button"
          className="mt-4"
          onClick={handleEnviar}
          disabled={enviando || !emailDestinatario.trim() || !assunto.trim() || !corpo.trim()}
        >
          <PaperPlaneTilt size={16} weight="bold" />
          {enviando ? 'Enviando…' : 'Enviar e-mail'}
        </Button>
      </div>
    </div>
  )
}
