import type { SupabaseClient } from '@supabase/supabase-js'
import { enviarEmail } from '../email'
import { processoInpiAtualizadoEmailHtml } from './emailTemplate'
import type { ResultadoConsultaInpi } from './cliente'
import type { Database, ProcessoInpi } from '../../../supabase/types'

export interface ProcessamentoResultado {
  mudou: boolean
  emailEnviado: boolean
  processo: ProcessoInpi
}

// Grava o resultado de uma consulta bem-sucedida (tipo "encontrado") em
// processos_inpi/eventos_processo_inpi e dispara o e-mail ao cliente
// quando houver mudança de situação/despacho — compartilhado pela rota
// manual (/api/inpi/verificar, botão "Verificar agora") e pelo cron
// (/api/jobs/verificar-inpi) pra não duplicar essa lógica entre os dois
// gatilhos. Lança em caso de erro de escrita no banco; quem chama decide
// como reportar isso (resposta HTTP de erro vs. contagem de falha no lote).
export async function processarResultadoInpi(
  admin: SupabaseClient<Database>,
  processo: ProcessoInpi,
  resultado: Extract<ResultadoConsultaInpi, { tipo: 'encontrado' }>,
  siteUrl: string
): Promise<ProcessamentoResultado> {
  const mudou = resultado.situacao !== processo.situacao || resultado.despachoDescricao !== processo.despacho_descricao

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
      processo_id: processo.id,
      despacho_codigo: null,
      despacho_descricao: resultado.despachoDescricao ?? resultado.situacao ?? 'Atualização sem descrição.',
      despacho_data: resultado.despachoData,
      situacao: resultado.situacao,
    } as never)
    if (eventoError) throw new Error(eventoError.message)
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
    .eq('id', processo.id)
    .select()
    .single()
  if (updateError) throw new Error(updateError.message)

  const processoAtualizado = atualizado as ProcessoInpi
  let emailEnviado = false
  if (mudou && processoAtualizado.cliente_email) {
    emailEnviado = await enviarEmail({
      para: processoAtualizado.cliente_email,
      assunto: `Atualização no processo ${processoAtualizado.numero_processo} do INPI`,
      html: processoInpiAtualizadoEmailHtml(processoAtualizado, processoAtualizado.workspace_id, siteUrl),
    })
  }

  return { mudou, emailEnviado, processo: processoAtualizado }
}
