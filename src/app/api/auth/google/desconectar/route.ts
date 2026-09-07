import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '../../../../../lib/supabaseAdmin'
import type { Database, GoogleCalendarConnection } from '../../../../../../supabase/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })

  const callerClient = createClient<Database>(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: userData } = await callerClient.auth.getUser()
  if (!userData.user) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

  const admin = createSupabaseAdminClient()
  const { data } = await admin
    .from('google_calendar_connections')
    .select('access_token')
    .eq('user_id', userData.user.id)
    .maybeSingle()

  const conexao = data as Pick<GoogleCalendarConnection, 'access_token'> | null
  if (conexao) {
    // Revoga o token na própria Google, além de apagar localmente — sem
    // isso a conexão "desaparece" só do nosso lado, mas continua válida
    // pra ser usada por quem tiver o refresh_token (não é o caso aqui,
    // mas revogar é o certo a fazer). Best-effort: se a Google já tiver
    // invalidado o token sozinha, essa chamada falha e não tem problema.
    await fetch(`https://oauth2.googleapis.com/revoke?token=${conexao.access_token}`, { method: 'POST' }).catch(() => {})
  }

  await admin.from('google_calendar_connections').delete().eq('user_id', userData.user.id)

  return NextResponse.json({ ok: true })
}
