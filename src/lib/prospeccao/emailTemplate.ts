// Envelope de marca reaproveitado pelo e-mail de prospecção — mesma
// paleta/logo do envelope de atualização de processo
// (src/lib/inpi/emailTemplate.ts), mas o conteúdo (assunto/corpo) vem
// pronto de fora: quem cadastrou o modelo em Prospecção escreveu esse
// texto, então aqui só formata (escapa + quebra de linha -> <br>) em vez
// de montar seções fixas como despacho/situação.
const ACCENT = '#c9a26b'
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

function corpoParaHtml(corpo: string): string {
  return escapeHtml(corpo).replace(/\n/g, '<br />')
}

export function prospeccaoEmailHtml({ corpo, siteUrl }: { corpo: string; siteUrl: string }): string {
  const logoUrl = `${siteUrl.replace(/\/$/, '')}/brand/revollution-logo-full.png`

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
              <td style="padding:32px;font-size:14px;line-height:1.7;color:${FOREGROUND};">
                ${corpoParaHtml(corpo)}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;border-top:1px solid ${BORDER};">
                <p style="margin:0;font-size:11px;color:${MUTED};">
                  Revollution — Marcas e Patentes
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export function substituirVariaveis(texto: string, valores: { nome?: string | null }): string {
  return texto.replace(/\{\{\s*nome\s*\}\}/gi, valores.nome?.trim() || '')
}
