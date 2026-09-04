import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '../../../../lib/supabaseAdmin'
import { abrirSessaoInpi, consultarProcesso } from '../../../../lib/inpi/cliente'
import { processarResultadoInpi } from '../../../../lib/inpi/processar'
import type { Database, ProcessoInpi } from '../../../../../supabase/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

// Consulta o portal público do INPI pra um processo e grava o resultado —
// disparada pelo botão "Verificar agora" na aba Processos (o cron diário
// em /api/jobs/verificar-inpi cobre a checagem automática). Usa a service
// role pra escrever porque só o job pode criar linhas em
// eventos_processo_inpi (ver 0021_processos_inpi.sql); por isso a checagem
// de que o chamador pertence ao workspace do processo é feita aqui, com o
// client do próprio usuário, antes de tocar em nada.
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
    .select('*')
    .eq('id', processoId)
    .maybeSingle()
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
  if (!processo) return NextResponse.json({ error: 'Processo não encontrado.' }, { status: 404 })

  const admin = createSupabaseAdminClient()

  let resultado
  try {
    const cookie = await abrirSessaoInpi(processo.tipo)
    resultado = await consultarProcesso({
      cookie,
      numeroProcesso: processo.numero_processo,
      tipo: processo.tipo,
    })
  } catch {
    return NextResponse.json({ error: 'Falha ao consultar o INPI. Tente novamente em instantes.' }, { status: 502 })
  }

  if (resultado.tipo === 'nao_reconhecido') {
    return NextResponse.json(
      { error: 'A página do INPI voltou num formato inesperado. Tente novamente mais tarde.' },
      { status: 502 }
    )
  }

  if (resultado.tipo === 'nao_encontrado') {
    const { error } = await admin
      .from('processos_inpi')
      .update({ ultima_verificacao_em: new Date().toISOString() } as never)
      .eq('id', processoId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ mudou: false, encontrado: false })
  }

  try {
    const { mudou, emailEnviado, processo: processoAtualizado } = await processarResultadoInpi(
      admin,
      processo as ProcessoInpi,
      resultado,
      siteUrl
    )
    return NextResponse.json({ mudou, encontrado: true, emailEnviado, processo: processoAtualizado })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao gravar a verificação.' }, { status: 500 })
  }
}
