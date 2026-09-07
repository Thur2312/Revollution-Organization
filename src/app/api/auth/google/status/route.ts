import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '../../../../../lib/supabaseAdmin'
import { googleOAuthConfigured } from '../../../../../lib/google/oauth'
import type { Database, GoogleCalendarConnection } from '../../../../../../supabase/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// google_calendar_connections não tem nenhuma policy de select pra
// authenticated (guarda tokens OAuth) — essa rota é o único jeito do
// client saber se o próprio usuário já conectou o Google Agenda.
export async function GET(request: Request) {
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
    .select('google_email')
    .eq('user_id', userData.user.id)
    .maybeSingle()

  return NextResponse.json({
    configurado: googleOAuthConfigured(),
    conectado: Boolean(data),
    googleEmail: (data as Pick<GoogleCalendarConnection, 'google_email'> | null)?.google_email ?? null,
  })
}
