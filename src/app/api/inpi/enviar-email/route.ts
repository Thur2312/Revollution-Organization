import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enviarEmail } from '../../../../lib/email'
import { processoInpiAtualizadoEmailHtml } from '../../../../lib/inpi/emailTemplate'
import type { Database, ProcessoInpiComCliente } from '../../../../../supabase/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

// Reenvia o e-mail de status pro cliente do processo sob demanda (botão
// "Enviar e-mail" na aba Processos) — ao contrário de /api/inpi/verificar,
// não consulta o INPI nem escreve nada, só manda o snapshot atual já
// salvo. Lê com o client do próprio chamador (RLS de is_workspace_member
// já cobre isso), sem precisar de service role.
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })

  const { processoId } = (await request.json()) as { processoId?: string }
  if (!processoId) return NextResponse.json({ error: 'processoId is required' }, { status: 400 })

  const callerClient = createClient<Database>(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: processo, error: fetchError } = await callerClient
    .from('processos_inpi')
    .select('*, cliente:clientes(*)')
    .eq('id', processoId)
    .maybeSingle()
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
  if (!processo) return NextResponse.json({ error: 'Processo não encontrado.' }, { status: 404 })

  const processoTyped = processo as unknown as ProcessoInpiComCliente
  if (!processoTyped.cliente?.email) {
    return NextResponse.json({ error: 'Esse processo não tem cliente com e-mail cadastrado.' }, { status: 400 })
  }

  const emailEnviado = await enviarEmail({
    para: processoTyped.cliente.email,
    assunto: `Atualização no processo ${processoTyped.numero_processo} do INPI`,
    html: processoInpiAtualizadoEmailHtml(processoTyped, processoTyped.cliente, processoTyped.workspace_id, siteUrl),
  })

  if (!emailEnviado) {
    return NextResponse.json(
      { error: 'Falha ao enviar o e-mail — confira se RESEND_API_KEY/RESEND_FROM_EMAIL estão configuradas.' },
      { status: 502 }
    )
  }

  return NextResponse.json({ emailEnviado: true })
}
