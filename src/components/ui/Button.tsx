import { ButtonHTMLAttributes, forwardRef } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive'
type Size = 'md' | 'sm'

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium ' +
  'transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none ' +
  'active:scale-[0.98] transition-transform'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-foreground hover:bg-accent/90',
  secondary: 'bg-primary text-primary-foreground hover:bg-primary/90',
  ghost: 'bg-transparent text-primary border border-border hover:bg-surface',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
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
