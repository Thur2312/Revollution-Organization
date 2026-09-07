import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { obterAccessTokenValido } from '../../../../lib/google/token'
import { removerEventoGoogle } from '../../../../lib/google/calendar'
import type { Compromisso, Database } from '../../../../../supabase/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Remove um compromisso e, se já tinha sido sincronizado, o evento
// correspondente no Google Agenda do dono. A remoção da linha em si usa
// o client do próprio chamador (RLS de compromissos_delete_own_or_admin
// decide se ele pode) — só a limpeza do lado Google precisa da service
// role, pra pegar o token OAuth do dono do compromisso.
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })

  const { compromissoId } = (await request.json()) as { compromissoId?: string }
  if (!compromissoId) return NextResponse.json({ error: 'compromissoId is required' }, { status: 400 })

  const callerClient = createClient<Database>(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: apagados, error: deleteError } = await callerClient
    .from('compromissos')
    .delete()
    .eq('id', compromissoId)
    .select()
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  const compromisso = (apagados as Compromisso[] | null)?.[0]
  if (!compromisso) {
    return NextResponse.json({ error: 'Compromisso não encontrado ou você não pode removê-lo.' }, { status: 403 })
  }

  if (compromisso.google_event_id) {
    const accessToken = await obterAccessTokenValido(compromisso.user_id)
    if (accessToken) {
      await removerEventoGoogle(accessToken, compromisso.google_event_id).catch(() => {})
    }
  }

  return NextResponse.json({ ok: true })
}
