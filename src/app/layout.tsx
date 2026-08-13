import './globals.css'
import { ReactNode } from 'react'

export const metadata = {
  title: 'Revollution Idea',
  description: 'MVP interno — boards e colaboração'
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh">{children}</body>
    </html>
  )
}
