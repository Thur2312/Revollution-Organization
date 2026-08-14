import { InputHTMLAttributes, forwardRef, ReactNode } from 'react'

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  icon?: ReactNode
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(
  ({ label, error, icon, id, className = '', ...props }, ref) => {
    const inputId = id ?? props.name
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {label}
        </label>
        <div className="relative">
          {icon && (
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`h-11 w-full rounded-lg border bg-background px-3.5 text-sm text-foreground
              placeholder:text-muted-foreground outline-none
              shadow-[inset_0_1px_2px_rgba(67,15,28,0.05)]
              transition-[border-color,box-shadow] duration-200 ease-out
              hover:border-accent/40
              focus:border-accent focus:shadow-[inset_0_1px_2px_rgba(67,15,28,0.05),0_0_0_4px_rgba(201,162,107,0.22)]
              disabled:cursor-not-allowed disabled:bg-surface disabled:text-muted-foreground disabled:shadow-none
              ${icon ? 'pl-10' : ''}
              ${error ? 'border-destructive' : 'border-border'}
              ${className}`}
            aria-invalid={!!error}
            {...props}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    )
  }
)
Field.displayName = 'Field'
