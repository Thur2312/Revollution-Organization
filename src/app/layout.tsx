import './globals.css'
import { ReactNode } from 'react'

export const metadata = {
  title: 'Revollution Idea',
  description: 'MVP interno — boards e colaboração'
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-gray-50 text-gray-900">{children}</body>
    </html>
  )
}
