import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '../../../../lib/supabaseAdmin'
import { obterAccessTokenValido } from '../../../../lib/google/token'
import { atualizarEventoGoogle, criarEventoGoogle } from '../../../../lib/google/calendar'
import type { Compromisso, Database } from '../../../../../supabase/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Empurra um compromisso (já existente em `compromissos`, criado/editado
// direto pelo client via RLS) pro Google Agenda de quem é o dono dele —
// cria se ainda não tinha google_event_id, atualiza se já tinha. Usa a
// service role só pra isso (ler o token OAuth do dono e gravar o
// resultado); a checagem de que o chamador pertence ao workspace do
// compromisso acontece com o client dele, lendo a linha via RLS antes de
// mexer em qualquer coisa.
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })

  const { compromissoId } = (await request.json()) as { compromissoId?: string }
  if (!compromissoId) return NextResponse.json({ error: 'compromissoId is required' }, { status: 400 })

  const callerClient = createClient<Database>(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: compromisso, error: fetchError } = await callerClient
    .from('compromissos')
    .select('*')
    .eq('id', compromissoId)
    .maybeSingle()
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
  if (!compromisso) return NextResponse.json({ error: 'Compromisso não encontrado.' }, { status: 404 })

  const admin = createSupabaseAdminClient()
  const compromissoTyped = compromisso as Compromisso

  const accessToken = await obterAccessTokenValido(compromissoTyped.user_id)
  if (!accessToken) {
    await admin
      .from('compromissos')
      .update({ status_sincronizacao: 'nao_conectado' } as never)
      .eq('id', compromissoId)
    return NextResponse.json({ sincronizado: false, motivo: 'nao_conectado' })
  }

  const evento = {
    titulo: compromissoTyped.titulo,
    descricao: compromissoTyped.descricao,
    local: compromissoTyped.local,
    inicio: compromissoTyped.inicio,
    fim: compromissoTyped.fim,
  }

  try {
    let googleEventId = compromissoTyped.google_event_id
    if (googleEventId) {
      await atualizarEventoGoogle(accessToken, googleEventId, evento)
    } else {
      googleEventId = await criarEventoGoogle(accessToken, evento)
    }

    const { data: atualizado, error: updateError } = await admin
      .from('compromissos')
      .update({ google_event_id: googleEventId, status_sincronizacao: 'sincronizado' } as never)
      .eq('id', compromissoId)
      .select()
      .single()
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    return NextResponse.json({ sincronizado: true, compromisso: atualizado as Compromisso })
  } catch {
    await admin.from('compromissos').update({ status_sincronizacao: 'falha' } as never).eq('id', compromissoId)
    return NextResponse.json({ sincronizado: false, motivo: 'falha' })
  }
}
