"use client"
import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { FileXls, UploadSimple, X } from '@phosphor-icons/react/dist/ssr'
import { supabase } from '../../lib/supabaseClient'
import { useAppSession } from '../../lib/AppSessionContext'
import type { BoardColumn as BoardColumnType, CardInsert } from '../../../supabase/types'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import {
  findLastNameHeader,
  guessColumnMapping,
  parseProposalValue,
  type ColumnMapping,
  type CrmField,
} from '../../lib/crm/columnMatch'

const FIELD_LABEL: Record<CrmField, string> = {
  client_name: 'Nome do cliente',
  client_phone: 'Número / telefone',
  client_email: 'E-mail',
  proposal_value: 'Valor da proposta',
}

const FIELD_ORDER: CrmField[] = ['client_name', 'client_phone', 'client_email', 'proposal_value']

type ParsedSheet = { headers: string[]; rows: string[][] }

// Some exported spreadsheets (ticketing/event platforms in particular) ship
// a stale <dimension> that only covers the first column, even though every
// column's cells are actually present in the sheet — sheet_to_json trusts
// that range and silently drops everything past it. Recompute the true
// range from the real cell addresses before reading, expanding only.
function fixStaleRange(sheet: XLSX.WorkSheet) {
  let maxRow = 0
  let maxCol = 0
  for (const key of Object.keys(sheet)) {
    if (key[0] === '!') continue
    const { r, c } = XLSX.utils.decode_cell(key)
    if (r > maxRow) maxRow = r
    if (c > maxCol) maxCol = c
  }
  const current = sheet['!ref'] ? XLSX.utils.decode_range(sheet['!ref']) : null
  if (!current || current.e.c < maxCol || current.e.r < maxRow) {
    sheet['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxRow, c: maxCol } })
  }
}

function countNonEmpty(row: unknown[]): number {
  return row.reduce((n: number, v) => n + (String(v ?? '').trim() !== '' ? 1 : 0), 0)
}

async function parseFile(file: File): Promise<ParsedSheet> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  fixStaleRange(sheet)
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })

  // Event/ticketing exports often prepend a few metadata rows (event name,
  // date, venue) before the real header row. The real header is the one
  // with the most populated cells within the first stretch of the sheet.
  let headerIdx = 0
  let headerCount = -1
  for (let i = 0; i < Math.min(30, raw.length); i++) {
    const count = countNonEmpty(raw[i] ?? [])
    if (count > headerCount) {
      headerCount = count
      headerIdx = i
    }
  }

  const headers = (raw[headerIdx] ?? []).map((v) => String(v).trim())
  const rows = raw
    .slice(headerIdx + 1)
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
      setMapping(guessColumnMapping(parsed.headers, parsed.rows))
    } catch {
      setError('Não foi possível ler esse arquivo. Confira se é um .xlsx, .xls ou .csv válido.')
    }
    setParsing(false)
  }

  const previewRows = useMemo(() => sheet?.rows.slice(0, 5) ?? [], [sheet])
  const nameColIndex = sheet?.headers.indexOf(mapping.client_name ?? '') ?? -1
  const lastNameHeader = useMemo(() => (sheet ? findLastNameHeader(sheet.headers, mapping) : undefined), [sheet, mapping])
  const lastNameColIndex = sheet && lastNameHeader ? sheet.headers.indexOf(lastNameHeader) : -1
  const canImport = !!sheet && nameColIndex !== -1 && !!targetColumnId

  function buildFullName(row: string[]): string {
    const first = nameColIndex !== -1 ? row[nameColIndex]?.trim() ?? '' : ''
    const last = lastNameColIndex !== -1 ? row[lastNameColIndex]?.trim() ?? '' : ''
    return [first, last].filter(Boolean).join(' ')
  }

  async function runImport() {
    if (!sheet || !userId || nameColIndex === -1) return
    setImporting(true)
    setError(null)

    const phoneCol = sheet.headers.indexOf(mapping.client_phone ?? '')
    const emailCol = sheet.headers.indexOf(mapping.client_email ?? '')
    const valueCol = sheet.headers.indexOf(mapping.proposal_value ?? '')

    // Every other column carries useful client detail (city, ticket type,
    // payment status, order number...) even though it doesn't map to a
    // dedicated CRM field — fold it into the card description instead of
    // dropping it, so the imported card stays fully detailed.
    const claimedHeaders = new Set(
      [mapping.client_name, mapping.client_phone, mapping.client_email, mapping.proposal_value, lastNameHeader].filter(
        (h): h is string => !!h
      )
    )
    const extraColumns = sheet.headers.map((h, i) => ({ header: h, index: i })).filter(({ header }) => !claimedHeaders.has(header))

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
      const name = buildFullName(row)
      if (!name) continue
      const descriptionLines = extraColumns
        .map(({ header, index }) => ({ header, value: row[index]?.trim() }))
        .filter(({ value }) => !!value)
        .map(({ header, value }) => `- **${header}**: ${value}`)
      payload.push({
        column_id: targetColumnId,
        title: name,
        description: descriptionLines.length > 0 ? descriptionLines.join('\n') : null,
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
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-wine/40 px-4 py-10 backdrop-blur-sm"
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
                  <p className="mb-2 text-xs text-muted-foreground">
                    As demais colunas da planilha são salvas como detalhes na descrição de cada card.
                  </p>
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
                              if (field === 'client_name') {
                                const name = buildFullName(row)
                                return (
                                  <td key={field} className="max-w-[9rem] truncate px-3 py-2 text-foreground">
                                    {name || '—'}
                                  </td>
                                )
                              }
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
