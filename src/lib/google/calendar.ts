const CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

export interface EventoGoogle {
  titulo: string
  descricao: string | null
  local: string | null
  inicio: string // ISO 8601
  fim: string // ISO 8601
}

function corpoEvento(evento: EventoGoogle) {
  return {
    summary: evento.titulo,
    description: evento.descricao ?? undefined,
    location: evento.local ?? undefined,
    start: { dateTime: evento.inicio },
    end: { dateTime: evento.fim },
  }
}

export async function criarEventoGoogle(accessToken: string, evento: EventoGoogle): Promise<string> {
  const resposta = await fetch(CALENDAR_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpoEvento(evento)),
  })
  if (!resposta.ok) throw new Error(`Falha ao criar evento no Google Agenda: ${await resposta.text()}`)
  const data = (await resposta.json()) as { id: string }
  return data.id
}

export async function atualizarEventoGoogle(accessToken: string, googleEventId: string, evento: EventoGoogle): Promise<void> {
  const resposta = await fetch(`${CALENDAR_API}/${googleEventId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpoEvento(evento)),
  })
  if (!resposta.ok) throw new Error(`Falha ao atualizar evento no Google Agenda: ${await resposta.text()}`)
}

export async function removerEventoGoogle(accessToken: string, googleEventId: string): Promise<void> {
  const resposta = await fetch(`${CALENDAR_API}/${googleEventId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  // 410 Gone = já tinha sido removido direto no Google — trata como sucesso,
  // não faz sentido falhar por algo que já está no estado desejado.
  if (!resposta.ok && resposta.status !== 410 && resposta.status !== 404) {
    throw new Error(`Falha ao remover evento no Google Agenda: ${await resposta.text()}`)
  }
}
