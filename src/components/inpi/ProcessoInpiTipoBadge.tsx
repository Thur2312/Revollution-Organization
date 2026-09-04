import type { TipoProcessoInpi } from '../../../supabase/types'

const styles: Record<TipoProcessoInpi, string> = {
  marca: 'bg-accent/10 text-accent border-accent/25',
  patente: 'bg-wine/10 text-wine border-wine/25',
  desenho_industrial: 'bg-surface text-muted-foreground border-border',
}

const labels: Record<TipoProcessoInpi, string> = {
  marca: 'Marca',
  patente: 'Patente',
  desenho_industrial: 'Desenho industrial',
}

export function ProcessoInpiTipoBadge({ tipo, className = '' }: { tipo: TipoProcessoInpi; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${styles[tipo]} ${className}`}
    >
      {labels[tipo]}
    </span>
  )
}
