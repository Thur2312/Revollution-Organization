import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '../../../../lib/supabaseAdmin'
import { abrirSessaoInpi, consultarProcesso } from '../../../../lib/inpi/cliente'
import { processarResultadoInpi } from '../../../../lib/inpi/processar'
import type { ProcessoInpiComCliente, TipoProcessoInpi } from '../../../../../supabase/types'

// Vercel Cron Job (ver vercel.json) — verifica processos ativos de todos
// os workspaces que não foram checados nos últimos INTERVALO_DIAS dias (a
// RPI só é publicada semanalmente, então checar mais que isso é
// desperdício de requisições contra o site do INPI). 60s é o teto de
// duração de função da Vercel no plano Hobby; a sessão anônima do INPI é
// reaproveitada por tipo dentro do lote pra caber nesse tempo.
export const maxDuration = 60

const LOTE = 20
const INTERVALO_ENTRE_VERIFICACOES_DIAS = 7

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  // A Vercel injeta esse header automaticamente ao chamar Cron Jobs
  // quando CRON_SECRET está setada no ambiente do projeto — sem ela, a
  // rota recusa qualquer chamador (não dá pra rodar o job sem o secret).
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  const admin = createSupabaseAdminClient()
  const limite = new Date(Date.now() - INTERVALO_ENTRE_VERIFICACOES_DIAS * 24 * 60 * 60 * 1000).toISOString()

  const { data: processos, error } = await admin
    .from('processos_inpi')
    .select('*, cliente:clientes(*)')
    .eq('ativo', true)
    .or(`ultima_verificacao_em.is.null,ultima_verificacao_em.lt.${limite}`)
    .limit(LOTE)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const lista = (processos ?? []) as unknown as ProcessoInpiComCliente[]

  let eventosCriados = 0
  let emailsEnviados = 0
  let semMudanca = 0
  let falhas = 0

  if (lista.length === 0) {
    return NextResponse.json({ processosVerificados: 0, eventosCriados, semMudanca, falhas, emailsEnviados })
  }

  // A sessão anônima é por tipo de busca (marca/patente/desenho usam JSPs
  // diferentes) — reaproveitar evita repetir o handshake pra cada processo.
  const cookiesPorTipo = new Map<TipoProcessoInpi, string>()

  for (const processo of lista) {
    try {
      let cookie = cookiesPorTipo.get(processo.tipo)
      if (!cookie) {
        cookie = await abrirSessaoInpi(processo.tipo)
        cookiesPorTipo.set(processo.tipo, cookie)
      }

      const resultado = await consultarProcesso({
        cookie,
        numeroProcesso: processo.numero_processo,
        tipo: processo.tipo,
      })

      if (resultado.tipo === 'nao_reconhecido') {
        falhas += 1
        continue
      }

      if (resultado.tipo === 'nao_encontrado') {
        await admin
          .from('processos_inpi')
          .update({ ultima_verificacao_em: new Date().toISOString() } as never)
          .eq('id', processo.id)
        semMudanca += 1
        continue
      }

      const { mudou, emailEnviado } = await processarResultadoInpi(admin, processo, resultado, siteUrl)
      if (mudou) {
        eventosCriados += 1
        if (emailEnviado) emailsEnviados += 1
      } else {
        semMudanca += 1
      }
    } catch {
      falhas += 1
    }
  }

  return NextResponse.json({ processosVerificados: lista.length, eventosCriados, semMudanca, falhas, emailsEnviados })
}
