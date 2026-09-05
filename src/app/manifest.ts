import type { MetadataRoute } from 'next'

// Next's app/manifest.ts file convention — auto-served at
// /manifest.webmanifest and auto-linked in <head>, no manual <link> tag
// needed. Lets browsers offer "Adicionar à tela inicial" / "Instalar app"
// so the board opens standalone (no address bar) like a native app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Revollution',
    short_name: 'Revollution',
    description: 'Boards, CRM e acompanhamento de processos do INPI.',
    start_url: '/app',
    display: 'standalone',
    background_color: '#faf6f1',
    theme_color: '#430f1c',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
