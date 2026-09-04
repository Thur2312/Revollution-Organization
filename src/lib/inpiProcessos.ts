import { supabase } from './supabaseClient'
import type { ProcessoInpi, TipoProcessoInpi } from '../../supabase/types'

export async function listarProcessosInpi(workspaceId: string): Promise<ProcessoInpi[]> {
  const { data, error } = await supabase
    .from('processos_inpi')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as ProcessoInpi[]
}

export async function adicionarProcessoInpi(params: {
  workspaceId: string
  userId: string
  numeroProcesso: string
  tipo: TipoProcessoInpi
  apelido: string | null
}): Promise<ProcessoInpi> {
  const { data, error } = await supabase
    .from('processos_inpi')
    .insert({
      workspace_id: params.workspaceId,
      numero_processo: params.numeroProcesso.trim(),
      tipo: params.tipo,
      apelido: params.apelido?.trim() || null,
      created_by: params.userId,
    })
    .select()
    .single()
  if (error) {
    // unique_violation — já existe um processo com esse número+tipo neste workspace.
    if (error.code === '23505') throw new Error('Esse processo já está sendo acompanhado neste workspace.')
    throw new Error(error.message)
  }
  return data as ProcessoInpi
}

export async function removerProcessoInpi(processoId: string): Promise<void> {
  const { error } = await supabase.from('processos_inpi').delete().eq('id', processoId)
  if (error) throw new Error(error.message)
}

export async function marcarEventoInpiLido(eventoId: string): Promise<void> {
  const { error } = await supabase.from('eventos_processo_inpi').update({ lido: true }).eq('id', eventoId)
  if (error) throw new Error(error.message)
}
