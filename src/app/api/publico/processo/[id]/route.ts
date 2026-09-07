import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '../../../../../lib/supabaseAdmin'
import type { EventoProcessoInpi, ProcessoInpi } from '../../../../../../supabase/types'

// Página pública que o cliente abre pelo link "Ver histórico completo" do
// e-mail de atualização — ele não tem conta no Revollution, então não dá
// pra mandar pra uma rota dentro de /app (exige login e ser membro do
// workspace). Usa a service role porque o acesso aqui não é por sessão,
// é por conhecer o id (uuid) do processo — só devolve os campos que já
// aparecem no e-mail, nada de dados internos do workspace (nome do
// workspace, quem criou, etc.).
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const admin = createSupabaseAdminClient()

  const { data: processo } = await admin
    .from('processos_inpi')
    .select(
      'id, numero_processo, tipo, apelido, nome, situacao, despacho_descricao, despacho_data, numero_rpi, titular, apresentacao, natureza, classe, ultima_verificacao_em'
    )
    .eq('id', params.id)
    .maybeSingle()
  if (!processo) return NextResponse.json({ error: 'Processo não encontrado.' }, { status: 404 })

  const { data: eventos } = await admin
    .from('eventos_processo_inpi')
    .select('id, despacho_descricao, despacho_data, situacao, encontrado_em')
    .eq('processo_id', params.id)
    .order('encontrado_em', { ascending: false })

  return NextResponse.json({
    processo: processo as Partial<ProcessoInpi>,
    eventos: (eventos ?? []) as Partial<EventoProcessoInpi>[],
  })
}
