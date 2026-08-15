import { supabase } from './supabaseClient'
import type { Board } from '../../supabase/types'

// Every workspace has at most one CRM board (enforced by a partial unique
// index on boards(workspace_id) where kind = 'crm'). Its funnel-stage
// columns are seeded automatically by the on_crm_board_created trigger the
// instant the row is inserted, so callers never manage columns themselves.
export async function ensureCrmBoard(workspaceId: string, userId: string): Promise<Board> {
  const { data: existing, error: selectError } = await supabase
    .from('boards')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('kind', 'crm')
    .maybeSingle()
  if (selectError) throw new Error(selectError.message)
  if (existing) return existing as Board

  const { data: created, error: insertError } = await supabase
    .from('boards')
    .insert({ workspace_id: workspaceId, name: 'CRM', kind: 'crm', created_by: userId })
    .select()
    .single()
  if (insertError) {
    // 23505 = unique_violation — another tab/request created it first
    // (race on the partial unique index), so just fetch what landed.
    if (insertError.code === '23505') {
      const { data: raced, error: racedError } = await supabase
        .from('boards')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('kind', 'crm')
        .single()
      if (racedError) throw new Error(racedError.message)
      return raced as Board
    }
    throw new Error(insertError.message)
  }
  return created as Board
}
