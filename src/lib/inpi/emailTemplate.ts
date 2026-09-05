import type { Cliente, ProcessoInpi } from '../../../supabase/types'

// Table-based layout with everything inlined — required for this to render
// consistently across email clients (Outlook desktop uses Word's engine:
// no flexbox/grid, no external stylesheet, spotty border-radius support).
// Colors/logo mirror the brand tokens in src/app/globals.css and
// src/components/ui/Logo.tsx so the email reads as the same product as
// the app, not a generic transactional template.
const WINE = '#430f1c'
const ACCENT = '#c9a26b'
const ACCENT_FOREGROUND = '#2b0a15'
const SURFACE = '#faf6f1'
const BORDER = '#e7dcc9'
const FOREGROUND = '#241c17'
const MUTED = '#6b5f52'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function processoInpiAtualizadoEmailHtml(
  processo: ProcessoInpi,
  cliente: Cliente | null,
  workspaceId: string,
  siteUrl: string
): string {
  const titulo = escapeHtml(processo.apelido || processo.nome || processo.numero_processo)
  const primeiroNome = cliente?.nome ? escapeHtml(cliente.nome.split(' ')[0]) : null
  const situacao = processo.situacao ? escapeHtml(processo.situacao) : null
  const despacho = processo.despacho_descricao ? escapeHtml(processo.despacho_descricao) : null
  const logoUrl = `${siteUrl.replace(/\/$/, '')}/brand/revollution-logo-full.png`
  const linkHistorico = `${siteUrl.replace(/\/$/, '')}/app/workspace/${workspaceId}/processos/${processo.id}`

  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background-color:${SURFACE};font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${SURFACE};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid ${BORDER};border-radius:12px;">
            <tr>
              <td style="padding:28px 32px;border-bottom:3px solid ${ACCENT};border-radius:12px 12px 0 0;">
                <img src="${logoUrl}" alt="Revollution — Marcas e Patentes" height="30" style="display:block;height:30px;width:auto;border:0;outline:none;" />
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 6px;font-size:11px;font-weight:bold;letter-spacing:0.14em;text-transform:uppercase;color:${ACCENT};">
                  Acompanhamento de processo · INPI
                </p>
                <h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;color:${WINE};font-weight:bold;">
                  ${titulo}
                </h1>

                <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:${FOREGROUND};">
                  Olá${primeiroNome ? `, ${primeiroNome}` : ''}. O processo
                  <strong>nº ${escapeHtml(processo.numero_processo)}</strong> que estamos acompanhando pra você
                  teve uma atualização no INPI.
                </p>

                ${
                  situacao
                    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
                  <tr>
                    <td style="background-color:${SURFACE};border:1px solid ${BORDER};border-radius:8px;padding:14px 18px;">
                      <p style="margin:0 0 4px;font-size:11px;font-weight:bold;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED};">
                        Situação atual
                      </p>
                      <p style="margin:0;font-size:15px;font-weight:bold;color:${FOREGROUND};">${situacao}</p>
                    </td>
                  </tr>
                </table>`
                    : ''
                }

                ${
                  despacho
                    ? `<p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:${FOREGROUND};">
                  <strong>Último despacho:</strong> ${despacho}
                </p>`
                    : ''
                }

                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-radius:8px;background-color:${ACCENT};">
                      <a href="${linkHistorico}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:bold;color:${ACCENT_FOREGROUND};text-decoration:none;border-radius:8px;">
                        Ver histórico completo
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;border-top:1px solid ${BORDER};">
                <p style="margin:0;font-size:12px;line-height:1.6;color:${MUTED};">
                  Consulta de conveniência, feita direto na base pública do INPI. Para efeitos legais, a
                  Revista da Propriedade Industrial (RPI) é o único canal oficial de publicação de despachos.
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:20px 0 0;font-size:11px;color:${MUTED};">
            Revollution — Marcas e Patentes
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`
}
