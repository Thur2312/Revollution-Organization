import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '../../../../lib/supabaseAdmin'
import { abrirSessaoInpi, consultarProcesso } from '../../../../lib/inpi/cliente'
import type { Database, ProcessoInpi } from '../../../../../supabase/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Consulta o portal público do INPI pra um processo e grava o resultado —
// disparada pelo botão "Verificar agora" na aba Processos. Usa a service
// role pra escrever porque só o job (aqui, esta rota) pode criar linhas em
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

  let cookie: string
  let resultado
  try {
    cookie = await abrirSessaoInpi(processo.tipo)
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

  const mudou =
    resultado.situacao !== processo.situacao || resultado.despachoDescricao !== processo.despacho_descricao

  const camposRicos = {
    numero_rpi: resultado.numeroRpi ?? processo.numero_rpi,
    dados_atualizados_ate: resultado.dadosAtualizadosAte ?? processo.dados_atualizados_ate,
    nome: resultado.nome ?? processo.nome,
    titular: resultado.titular ?? processo.titular,
    apresentacao: resultado.apresentacao ?? processo.apresentacao,
    natureza: resultado.natureza ?? processo.natureza,
    classe: resultado.classe ?? processo.classe,
  }

  if (mudou) {
    const { error: eventoError } = await admin.from('eventos_processo_inpi').insert({
      processo_id: processoId,
      despacho_codigo: null,
      despacho_descricao: resultado.despachoDescricao ?? resultado.situacao ?? 'Atualização sem descrição.',
      despacho_data: resultado.despachoData,
      situacao: resultado.situacao,
    } as never)
    if (eventoError) return NextResponse.json({ error: eventoError.message }, { status: 500 })
  }

  const { data: atualizado, error: updateError } = await admin
    .from('processos_inpi')
    .update({
      ...camposRicos,
      situacao: resultado.situacao,
      despacho_descricao: resultado.despachoDescricao,
      despacho_data: resultado.despachoData,
      ultima_verificacao_em: new Date().toISOString(),
    } as never)
    .eq('id', processoId)
    .select()
    .single()
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ mudou, encontrado: true, processo: atualizado as ProcessoInpi })
}
