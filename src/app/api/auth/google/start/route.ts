import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { assinarEstado, googleOAuthConfigured, montarUrlAutorizacao } from '../../../../../lib/google/oauth'
import type { Database } from '../../../../../../supabase/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Devolve a URL de consentimento da Google pro botão "Conectar Google
// Agenda" redirecionar o navegador — não faz o redirect ela mesma porque
// precisa do Authorization header (fetch) pra saber quem é o usuário
// antes de assinar o `state` que o callback vai confiar depois.
export async function POST(request: Request) {
  if (!googleOAuthConfigured()) {
    return NextResponse.json(
      { error: 'Integração com Google Agenda não configurada (faltam GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_OAUTH_STATE_SECRET).' },
      { status: 503 }
    )
  }

  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })

  const { workspaceId } = (await request.json()) as { workspaceId?: string }
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })

  const callerClient = createClient<Database>(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: userData } = await callerClient.auth.getUser()
  if (!userData.user) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

  const state = assinarEstado({ userId: userData.user.id, workspaceId, ts: Date.now() })
  return NextResponse.json({ url: montarUrlAutorizacao(state) })
}
