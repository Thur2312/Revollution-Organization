import { createSupabaseAdminClient } from '../supabaseAdmin'
import { renovarAccessToken } from './oauth'
import type { GoogleCalendarConnection } from '../../../supabase/types'

const MARGEM_EXPIRACAO_MS = 60_000

// Devolve um access token válido pro Google Calendar do usuário, renovando
// via refresh_token se estiver perto de expirar. `null` = usuário nunca
// conectou o Google Agenda.
export async function obterAccessTokenValido(userId: string): Promise<string | null> {
  const admin = createSupabaseAdminClient()
  const { data } = await admin.from('google_calendar_connections').select('*').eq('user_id', userId).maybeSingle()
  if (!data) return null
  const conexao = data as GoogleCalendarConnection

  const expiraEm = new Date(conexao.token_expiry).getTime()
  if (expiraEm - Date.now() > MARGEM_EXPIRACAO_MS) return conexao.access_token

  const renovado = await renovarAccessToken(conexao.refresh_token)
  const novoExpiry = new Date(Date.now() + renovado.expires_in * 1000).toISOString()
  await admin
    .from('google_calendar_connections')
    .update({ access_token: renovado.access_token, token_expiry: novoExpiry } as never)
    .eq('user_id', userId)

  return renovado.access_token
}
