import Link from 'next/link'
import { ArrowLeft } from '@phosphor-icons/react/dist/ssr'

export function BackToSite() {
  return (
    <Link
      href="/"
      className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
    >
      <ArrowLeft size={16} />
      Voltar ao site
    </Link>
  )
}
