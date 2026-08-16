import { ButtonHTMLAttributes, forwardRef } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive'
type Size = 'md' | 'sm'

// Custom back-out ease instead of Tailwind's defaults — gives hover/press a
// faint tactile "give" instead of a flat, instant Material-style state swap.
const EASE = 'ease-[cubic-bezier(0.34,1.56,0.64,1)]'

const base =
  `inline-flex items-center justify-center gap-2 rounded-xl font-medium ` +
  `transition-[transform,box-shadow,background-color,border-color] duration-200 ${EASE} ` +
  `disabled:opacity-50 disabled:pointer-events-none disabled:translate-y-0 disabled:shadow-none ` +
  `active:translate-y-0 active:duration-75`

const variants: Record<Variant, string> = {
  primary:
    'bg-gradient-to-b from-[#d8b280] to-accent text-accent-foreground ' +
    'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35),0_1px_2px_rgba(67,15,28,0.15)] ' +
    'hover:-translate-y-px hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35),0_4px_10px_rgba(67,15,28,0.22)] ' +
    'hover:from-[#ddb98c] hover:to-[#d1ab78]',
  secondary:
    'bg-gradient-to-b from-[#5c1f30] to-wine text-wine-foreground ' +
    'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_1px_2px_rgba(67,15,28,0.25)] ' +
    'hover:-translate-y-px hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_4px_10px_rgba(67,15,28,0.3)] ' +
    'hover:from-[#6b2639] hover:to-[#4d1220]',
  ghost:
    'bg-transparent text-primary border border-border ' +
    'hover:-translate-y-px hover:bg-surface hover:border-accent/50 hover:shadow-[0_2px_8px_rgba(67,15,28,0.08)]',
  destructive:
    'bg-gradient-to-b from-[#e5504a] to-destructive text-destructive-foreground ' +
    'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2),0_1px_2px_rgba(220,38,38,0.25)] ' +
    'hover:-translate-y-px hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2),0_4px_10px_rgba(220,38,38,0.3)]',
}

const sizes: Record<Size, string> = {
  md: 'h-11 px-5 text-sm',
  sm: 'h-9 px-4 text-sm',
}

export function buttonClasses(variant: Variant = 'primary', size: Size = 'md', className = '') {
  return [base, variants[variant], sizes[size], className].join(' ')
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', ...props }, ref) => (
    <button ref={ref} className={buttonClasses(variant, size, className)} {...props} />
  )
)
Button.displayName = 'Button'
