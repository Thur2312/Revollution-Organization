import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enviarEmail } from '../../../../lib/email'
import { prospeccaoEmailHtml } from '../../../../lib/prospeccao/emailTemplate'
import type { Database } from '../../../../../supabase/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

// Envia um e-mail de prospecção avulso (aba Prospecção) — assunto/corpo
// já vêm prontos do cliente (com {{nome}} já substituído lá), então essa
// rota só confere que o chamador é membro do workspace antes de gastar a
// cota do Resend, e embrulha o corpo no envelope de marca.
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })

  const { workspaceId, destinatarioEmail, assunto, corpo } = (await request.json()) as {
    workspaceId?: string
    destinatarioEmail?: string
    assunto?: string
    corpo?: string
  }
  if (!workspaceId || !destinatarioEmail || !assunto?.trim() || !corpo?.trim()) {
    return NextResponse.json({ error: 'workspaceId, destinatarioEmail, assunto e corpo são obrigatórios.' }, { status: 400 })
  }

  const callerClient = createClient<Database>(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: userData } = await callerClient.auth.getUser()
  if (!userData.user) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

  const { data: membership, error: membershipError } = await callerClient
    .from('memberships')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userData.user.id)
    .maybeSingle()
  if (membershipError) return NextResponse.json({ error: membershipError.message }, { status: 500 })
  if (!membership) return NextResponse.json({ error: 'Você não pertence a esse workspace.' }, { status: 403 })

  const enviado = await enviarEmail({
    para: destinatarioEmail,
    assunto,
    html: prospeccaoEmailHtml({ corpo, siteUrl }),
  })

  if (!enviado) {
    return NextResponse.json(
      { error: 'Falha ao enviar o e-mail — confira se RESEND_API_KEY/RESEND_FROM_EMAIL estão configuradas.' },
      { status: 502 }
    )
  }

  return NextResponse.json({ enviado: true })
}
