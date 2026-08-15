"use client"
import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { FileXls, UploadSimple, X } from '@phosphor-icons/react/dist/ssr'
import { supabase } from '../../lib/supabaseClient'
import { useAppSession } from '../../lib/AppSessionContext'
import type { BoardColumn as BoardColumnType, CardInsert } from '../../../supabase/types'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import { guessColumnMapping, parseProposalValue, type ColumnMapping, type CrmField } from '../../lib/crm/columnMatch'

const FIELD_LABEL: Record<CrmField, string> = {
  client_name: 'Nome do cliente',
  client_phone: 'Número / telefone',
  client_email: 'E-mail',
  proposal_value: 'Valor da proposta',
}

const FIELD_ORDER: CrmField[] = ['client_name', 'client_phone', 'client_email', 'proposal_value']

type ParsedSheet = { headers: string[]; rows: string[][] }

async function parseFile(file: File): Promise<ParsedSheet> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
  const headers = (raw[0] ?? []).map((v) => String(v).trim())
  const rows = raw
    .slice(1)
    .map((r) => headers.map((_, i) => String(r[i] ?? '').trim()))
    .filter((r) => r.some((v) => v !== ''))
  return { headers, rows }
}

export function ImportSpreadsheetModal({
  columns,
  onClose,
  onImported,
}: {
  columns: BoardColumnType[]
  onClose: () => void
  onImported: (count: number) => void
}) {
  const { userId } = useAppSession()
  const [sheet, setSheet] = useState<ParsedSheet | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [targetColumnId, setTargetColumnId] = useState(columns[0]?.id ?? '')
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  async function handleFile(file: File) {
    setError(null)
    setParsing(true)
    try {
      const parsed = await parseFile(file)
      if (parsed.headers.length === 0) {
        setError('Não encontramos uma linha de cabeçalho nessa planilha.')
        setParsing(false)
        return
      }
      setSheet(parsed)
      setMapping(guessColumnMapping(parsed.headers))
    } catch {
      setError('Não foi possível ler esse arquivo. Confira se é um .xlsx, .xls ou .csv válido.')
    }
    setParsing(false)
  }

  const previewRows = useMemo(() => sheet?.rows.slice(0, 5) ?? [], [sheet])
  const nameColIndex = sheet?.headers.indexOf(mapping.client_name ?? '') ?? -1
  const canImport = !!sheet && nameColIndex !== -1 && !!targetColumnId

  async function runImport() {
    if (!sheet || !userId || nameColIndex === -1) return
    setImporting(true)
    setError(null)

    const phoneCol = sheet.headers.indexOf(mapping.client_phone ?? '')
    const emailCol = sheet.headers.indexOf(mapping.client_email ?? '')
    const valueCol = sheet.headers.indexOf(mapping.proposal_value ?? '')

    const { data: last } = await supabase
      .from('cards')
      .select('position')
      .eq('column_id', targetColumnId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle()
    let position = ((last as { position: number } | null)?.position ?? -1) + 1

    const payload: CardInsert[] = []
    for (const row of sheet.rows) {
      const name = row[nameColIndex]?.trim()
      if (!name) continue
      payload.push({
        column_id: targetColumnId,
        title: name,
        position: position++,
        metadata: {
          ...(phoneCol !== -1 && row[phoneCol] ? { client_phone: row[phoneCol].trim() } : {}),
          ...(emailCol !== -1 && row[emailCol] ? { client_email: row[emailCol].trim() } : {}),
          ...(valueCol !== -1 && row[valueCol] ? { proposal_value: parseProposalValue(row[valueCol]) } : {}),
        },
        created_by: userId,
      })
    }

    if (payload.length === 0) {
      setImporting(false)
      setError('Nenhuma linha com nome de cliente preenchido foi encontrada.')
      return
    }

    const { error: insertError } = await supabase.from('cards').insert(payload)
    setImporting(false)
    if (insertError) return setError(insertError.message)
    onImported(payload.length)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-primary/40 px-4 py-10 backdrop-blur-sm"
      style={{ animation: 'backdrop-in 150ms ease-out' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-2xl border border-border bg-background shadow-xl"
        style={{ animation: 'modal-in 220ms cubic-bezier(0.16,1,0.3,1)' }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-primary">Importar planilha</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-surface hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto px-6 py-5">
          {error && (
            <p role="alert" className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          {!sheet ? (
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border py-14 text-center hover:border-accent">
              {parsing ? (
                <p className="text-sm text-muted-foreground">Lendo planilha…</p>
              ) : (
                <>
                  <UploadSimple size={28} className="text-muted-foreground" />
                  <p className="text-sm font-medium text-primary">Selecione um arquivo .xlsx, .xls ou .csv</p>
                  <p className="text-sm text-muted-foreground">Vamos reconhecer as colunas automaticamente.</p>
                </>
              )}
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                disabled={parsing}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFile(file)
                  e.target.value = ''
                }}
              />
            </label>
          ) : (
            <>
              <div className="mb-5 flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground">
                <FileXls size={16} className="text-accent" />
                {sheet.rows.length} {sheet.rows.length === 1 ? 'linha encontrada' : 'linhas encontradas'}
                <button
                  type="button"
                  onClick={() => {
                    setSheet(null)
                    setMapping({})
                  }}
                  className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                >
                  Trocar arquivo
                </button>
              </div>

              <h3 className="mb-2 text-sm font-medium text-primary">Confirme o mapeamento das colunas</h3>
              <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {FIELD_ORDER.map((field) => (
                  <Select
                    key={field}
                    label={field === 'client_name' ? `${FIELD_LABEL[field]} *` : FIELD_LABEL[field]}
                    value={mapping[field] ?? ''}
                    onChange={(e) => setMapping((prev) => ({ ...prev, [field]: e.target.value || undefined }))}
                  >
                    <option value="">Não importar</option>
                    {sheet.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </Select>
                ))}
              </div>

              <Select
                label="Importar clientes para a etapa"
                value={targetColumnId}
                onChange={(e) => setTargetColumnId(e.target.value)}
                className="mb-5"
              >
                {columns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>

              {previewRows.length > 0 && (
                <div className="mb-2">
                  <h3 className="mb-2 text-sm font-medium text-primary">Pré-visualização</h3>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-surface text-muted-foreground">
                        <tr>
                          {FIELD_ORDER.map((field) => (
                            <th key={field} className="px-3 py-2 font-medium">
                              {FIELD_LABEL[field]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, i) => (
                          <tr key={i} className="border-t border-border">
                            {FIELD_ORDER.map((field) => {
                              const idx = sheet.headers.indexOf(mapping[field] ?? '')
                              return (
                                <td key={field} className="max-w-[9rem] truncate px-3 py-2 text-foreground">
                                  {idx !== -1 ? row[idx] : '—'}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {sheet && (
          <div className="flex justify-end gap-2.5 border-t border-border px-6 py-4">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button size="sm" disabled={!canImport || importing} onClick={runImport}>
              {importing ? 'Importando…' : `Importar ${sheet.rows.length} ${sheet.rows.length === 1 ? 'cliente' : 'clientes'}`}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
