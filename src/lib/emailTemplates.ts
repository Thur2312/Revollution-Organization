import { supabase } from './supabaseClient'
import type { EmailTemplate } from '../../supabase/types'

const CHAVE_PROSPECCAO = 'prospeccao'

export async function obterTemplateProspeccao(workspaceId: string): Promise<EmailTemplate | null> {
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('chave', CHAVE_PROSPECCAO)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as EmailTemplate | null
}

export async function salvarTemplateProspeccao(
  workspaceId: string,
  userId: string,
  { assunto, corpo }: { assunto: string; corpo: string }
): Promise<EmailTemplate> {
  const { data, error } = await supabase
    .from('email_templates')
    .upsert(
      { workspace_id: workspaceId, chave: CHAVE_PROSPECCAO, assunto, corpo, updated_by: userId, updated_at: new Date().toISOString() },
      { onConflict: 'workspace_id,chave' }
    )
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as EmailTemplate
}
