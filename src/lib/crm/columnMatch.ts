// Fuzzy header matching for CRM spreadsheet import. Bank/CRM export sheets
// name their columns inconsistently ("Cliente" vs "Nome do cliente", "Fone"
// vs "WhatsApp"...) — we normalize and match against a synonym list per
// field instead of requiring an exact header name.

export type CrmField = 'client_name' | 'client_phone' | 'client_email' | 'proposal_value'

const FIELD_SYNONYMS: Record<CrmField, string[]> = {
  client_name: ['nome', 'nome do cliente', 'nome cliente', 'cliente', 'razao social', 'contato'],
  client_phone: ['numero', 'número', 'telefone', 'celular', 'whatsapp', 'fone', 'contato telefone', 'tel'],
  client_email: ['email', 'e-mail', 'correio eletronico', 'endereco de email'],
  proposal_value: [
    'valor',
    'valor da proposta',
    'valor proposta',
    'proposta',
    'valor do contrato',
    'valor contrato',
    'preco',
    'preço',
  ],
}

// Strips diacritics (NFD combining marks, U+0300–U+036F) after decomposition
// so "número"/"numero" and "e-mail"/"email" normalize to the same key.
export function normalizeHeader(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const LAST_NAME_SYNONYMS = ['sobrenome', 'last name', 'apelido']

export type ColumnMapping = Partial<Record<CrmField, string>>

// Picks the best-scoring header per field. A header can only be claimed by
// one field — once matched, it's removed from the candidate pool so e.g.
// "contato" doesn't get reused for both nome and telefone.
//
// `rows` (optional sample data) breaks ties between equally-scored headers
// in favor of whichever is actually filled in more often — some exports
// carry near-duplicate columns (e.g. "Telefone" + "Whatsapp") where only
// one is consistently populated, and picking the emptier one by header
// order alone would import a mostly-blank field.
export function guessColumnMapping(headers: string[], rows: string[][] = []): ColumnMapping {
  const normalized = headers.map((h, index) => ({ header: h, index, norm: normalizeHeader(h) }))
  const fillCounts = normalized.map(({ index }) => rows.reduce((n, r) => n + (r[index]?.trim() ? 1 : 0), 0))
  const claimed = new Set<string>()
  const mapping: ColumnMapping = {}

  const fieldOrder: CrmField[] = ['client_email', 'client_phone', 'proposal_value', 'client_name']

  for (const field of fieldOrder) {
    const synonyms = FIELD_SYNONYMS[field]
    let best: { header: string; index: number; score: number } | null = null

    for (const { header, index, norm } of normalized) {
      if (claimed.has(header) || !norm) continue
      for (const synonym of synonyms) {
        let score = 0
        if (norm === synonym) score = 100
        else if (norm.includes(synonym) || synonym.includes(norm)) score = 60
        if (score === 0) continue
        const better = !best || score > best.score || (score === best.score && fillCounts[index] > fillCounts[best.index])
        if (better) best = { header, index, score }
      }
    }

    if (best) {
      mapping[field] = best.header
      claimed.add(best.header)
    }
  }

  return mapping
}

// Ticket/event exports commonly split the name into "Nome" + "Sobrenome" —
// find the surname column (if any) so callers can append it onto whatever
// header was matched for client_name.
export function findLastNameHeader(headers: string[], mapping: ColumnMapping): string | undefined {
  const claimed = new Set(Object.values(mapping).filter(Boolean) as string[])
  for (const header of headers) {
    if (claimed.has(header)) continue
    if (LAST_NAME_SYNONYMS.includes(normalizeHeader(header))) return header
  }
  return undefined
}

// Best-effort parse of Brazilian-formatted currency/number strings
// ("R$ 1.234,56", "1234.56", "1.500", "15000,00") into a plain number.
// Falls back to 0 when nothing parseable is found.
export function parseProposalValue(raw: string | number | undefined | null): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0
  if (!raw) return 0
  const cleaned = String(raw)
    .replace(/[^\d.,-]/g, '')
    .trim()
  if (!cleaned) return 0

  const hasComma = cleaned.includes(',')
  const hasDot = cleaned.includes('.')
  let normalized = cleaned
  if (hasComma && hasDot) {
    // Whichever separator appears last is the decimal separator.
    normalized = cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '')
  } else if (hasComma) {
    normalized = cleaned.replace(',', '.')
  }

  const value = parseFloat(normalized)
  return Number.isFinite(value) ? value : 0
}
