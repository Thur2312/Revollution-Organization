import { supabase } from './supabaseClient'
import type { Cliente } from '../../supabase/types'

export interface CadastroCliente {
  nome: string | null
  email: string | null
  documento: string | null
  telefone: string | null
  observacoes: string | null
}

function cadastroVazio(cadastro: CadastroCliente) {
  return !cadastro.nome?.trim() && !cadastro.email?.trim() && !cadastro.documento?.trim() && !cadastro.telefone?.trim()
}

export async function listarClientes(workspaceId: string): Promise<Cliente[]> {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('nome', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as Cliente[]
}

export async function criarCliente(
  workspaceId: string,
  userId: string,
  cadastro: CadastroCliente
): Promise<Cliente | null> {
  if (cadastroVazio(cadastro)) return null
  const { data, error } = await supabase
    .from('clientes')
    .insert({
      workspace_id: workspaceId,
      nome: cadastro.nome?.trim() || null,
      email: cadastro.email?.trim() || null,
      documento: cadastro.documento?.trim() || null,
      telefone: cadastro.telefone?.trim() || null,
      observacoes: cadastro.observacoes?.trim() || null,
      created_by: userId,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as Cliente
}

export async function atualizarCliente(clienteId: string, cadastro: CadastroCliente): Promise<Cliente> {
  const { data, error } = await supabase
    .from('clientes')
    .update({
      nome: cadastro.nome?.trim() || null,
      email: cadastro.email?.trim() || null,
      documento: cadastro.documento?.trim() || null,
      telefone: cadastro.telefone?.trim() || null,
      observacoes: cadastro.observacoes?.trim() || null,
    })
    .eq('id', clienteId)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as Cliente
}
