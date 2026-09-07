import { createHmac, timingSafeEqual } from 'crypto'

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/calendar.events'].join(' ')

function redirectUri() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  return `${siteUrl.replace(/\/$/, '')}/api/auth/google/callback`
}

export function googleOAuthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_OAUTH_STATE_SECRET)
}

// O redirect final da Google (GET, sem cabeçalho de auth) precisa saber
// pra qual usuário/workspace voltar sem confiar em nada que o navegador
// mande de volta sem verificação — por isso o `state` carrega
// userId+workspaceId+timestamp assinado com HMAC (mesma ideia de um JWT
// simplificado, sem dependência extra).
interface EstadoOAuth {
  userId: string
  workspaceId: string
  ts: number
}

export function assinarEstado(estado: EstadoOAuth): string {
  const secret = process.env.GOOGLE_OAUTH_STATE_SECRET
  if (!secret) throw new Error('GOOGLE_OAUTH_STATE_SECRET não configurada')
  const payload = Buffer.from(JSON.stringify(estado)).toString('base64url')
  const assinatura = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${assinatura}`
}

export function verificarEstado(state: string): EstadoOAuth | null {
  const secret = process.env.GOOGLE_OAUTH_STATE_SECRET
  if (!secret) return null
  const [payload, assinatura] = state.split('.')
  if (!payload || !assinatura) return null

  const esperada = createHmac('sha256', secret).update(payload).digest('base64url')
  const bufA = Buffer.from(assinatura)
  const bufB = Buffer.from(esperada)
  if (bufA.length !== bufB.length || !timingSafeEqual(bufA, bufB)) return null

  // Estado expira em 10 minutos — tempo de sobra pro usuário passar pela
  // tela de consentimento da Google, mas sem deixar um link velho
  // reutilizável indefinidamente.
  try {
    const estado = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as EstadoOAuth
    if (Date.now() - estado.ts > 10 * 60 * 1000) return null
    return estado
  } catch {
    return null
  }
}

export function montarUrlAutorizacao(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `${AUTH_ENDPOINT}?${params.toString()}`
}

interface TokensGoogle {
  access_token: string
  refresh_token?: string
  expires_in: number
  id_token?: string
}

export async function trocarCodigoPorTokens(code: string): Promise<TokensGoogle> {
  const resposta = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code',
    }),
  })
  if (!resposta.ok) throw new Error(`Falha ao trocar código por tokens: ${await resposta.text()}`)
  return resposta.json()
}

export async function renovarAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const resposta = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      grant_type: 'refresh_token',
    }),
  })
  if (!resposta.ok) throw new Error(`Falha ao renovar access token: ${await resposta.text()}`)
  return resposta.json()
}

// Só decodifica o payload do id_token (JWT) pra pegar o e-mail — não
// precisa validar assinatura porque o token veio direto do endpoint HTTPS
// da própria Google na troca de código (canal já confiável), sem passar
// pelo navegador do usuário.
export function extrairEmailDoIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null
  try {
    const payload = idToken.split('.')[1]
    if (!payload) return null
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as { email?: string }
    return decoded.email ?? null
  } catch {
    return null
  }
}
