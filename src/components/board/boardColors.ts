import type { BoardColor } from '../../../supabase/types'

// Fixed palette so the frontend renders known Tailwind class names (never
// interpolates a stored value into a class string / inline style) and
// stays visually consistent with the rest of the app.
export const BOARD_COLORS: BoardColor[] = ['accent', 'rose', 'amber', 'emerald', 'sky', 'violet', 'slate']

const LABEL: Record<BoardColor, string> = {
  accent: 'Dourado',
  rose: 'Rosa',
  amber: 'Âmbar',
  emerald: 'Esmeralda',
  sky: 'Azul',
  violet: 'Violeta',
  slate: 'Cinza',
}

// `icon` tints the small badge boards render as (BoardList card, board page
// header). `dot`/`swatch` are solid fills used for the sidebar list marker
// and the color-picker buttons themselves.
const CLASSES: Record<BoardColor, { icon: string; dot: string }> = {
  accent: { icon: 'bg-accent/10 text-accent', dot: 'bg-accent' },
  rose: { icon: 'bg-rose-100 text-rose-600', dot: 'bg-rose-500' },
  amber: { icon: 'bg-amber-100 text-amber-600', dot: 'bg-amber-500' },
  emerald: { icon: 'bg-emerald-100 text-emerald-600', dot: 'bg-emerald-500' },
  sky: { icon: 'bg-sky-100 text-sky-600', dot: 'bg-sky-500' },
  violet: { icon: 'bg-violet-100 text-violet-600', dot: 'bg-violet-500' },
  slate: { icon: 'bg-slate-100 text-slate-600', dot: 'bg-slate-500' },
}

export function boardColorLabel(color: BoardColor): string {
  return LABEL[color]
}

export function boardColorClasses(color: BoardColor | null | undefined) {
  return CLASSES[color ?? 'accent']
}

// CRM funnel columns are fixed stages (seeded by position, see
// seed_crm_stages()), so instead of a user-picked board color each stage
// gets a color tied to its place in the funnel — cool/neutral for early
// stages, warming up through negotiation, emerald at the close. The column
// body itself is filled solid with `bg`; `text`/`subtle` are the readable
// foreground colors for that fill — cards keep their own light background
// (see BoardCard), so they stay visually distinct from the colored column.
const CRM_STAGE_CLASSES: { bg: string; text: string; subtle: string }[] = [
  { bg: 'bg-sky-500', text: 'text-white', subtle: 'text-white/70' }, // Prospecção
  { bg: 'bg-violet-500', text: 'text-white', subtle: 'text-white/70' }, // Abordagem
  { bg: 'bg-accent', text: 'text-primary', subtle: 'text-primary/60' }, // Apresentação
  { bg: 'bg-amber-500', text: 'text-primary', subtle: 'text-primary/60' }, // Acompanhamento (follow-up)
  { bg: 'bg-rose-500', text: 'text-white', subtle: 'text-white/70' }, // Negociação
  { bg: 'bg-emerald-500', text: 'text-white', subtle: 'text-white/70' }, // Fechamento
  { bg: 'bg-slate-500', text: 'text-white', subtle: 'text-white/70' }, // Pós-venda
]

export function crmStageAccent(position: number) {
  return CRM_STAGE_CLASSES[position % CRM_STAGE_CLASSES.length]
}
