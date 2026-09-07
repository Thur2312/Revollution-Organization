import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '../../../../../lib/supabaseAdmin'
import { extrairEmailDoIdToken, trocarCodigoPorTokens, verificarEstado } from '../../../../../lib/google/oauth'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

function redirecionarParaAgenda(workspaceId: string, resultado: 'conectado' | 'erro') {
  return NextResponse.redirect(`${siteUrl.replace(/\/$/, '')}/app/workspace/${workspaceId}/agenda?google=${resultado}`)
}

// A Google chama esta rota via GET (redirect de navegação, sem
// Authorization header) — por isso a identidade de quem iniciou o fluxo
// vem só do `state` assinado em /api/auth/google/start, não de sessão.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  if (!state) return NextResponse.json({ error: 'Missing state' }, { status: 400 })

  const estado = verificarEstado(state)
  if (!estado) return redirecionarParaAgenda('', 'erro')

  if (!code) return redirecionarParaAgenda(estado.workspaceId, 'erro')

  try {
    const tokens = await trocarCodigoPorTokens(code)
    if (!tokens.refresh_token) {
      // Sem refresh_token normalmente significa que o usuário já tinha
      // autorizado antes e a Google não reemitiu um novo — `prompt=consent`
      // em montarUrlAutorizacao deveria evitar isso, mas se acontecer não
      // dá pra manter a conexão viva (sem como renovar o access token).
      return redirecionarParaAgenda(estado.workspaceId, 'erro')
    }

    const admin = createSupabaseAdminClient()
    await admin.from('google_calendar_connections').upsert(
      {
        user_id: estado.userId,
        google_email: extrairEmailDoIdToken(tokens.id_token),
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expiry: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      } as never,
      { onConflict: 'user_id' }
    )

    return redirecionarParaAgenda(estado.workspaceId, 'conectado')
  } catch {
    return redirecionarParaAgenda(estado.workspaceId, 'erro')
  }
}
