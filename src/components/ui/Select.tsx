import { SelectHTMLAttributes, forwardRef } from 'react'
import { CaretDown } from '@phosphor-icons/react/dist/ssr'

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string
  size?: 'md' | 'sm'
}

const sizeClasses = {
  md: 'h-11 pl-3.5 pr-9 text-sm',
  sm: 'h-9 pl-3 pr-8 text-xs',
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, size = 'md', id, className = '', children, ...props }, ref) => {
    const selectId = id ?? props.name
    const select = (
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={`w-full appearance-none rounded-lg border border-border bg-background text-foreground
            outline-none shadow-[inset_0_1px_2px_rgba(67,15,28,0.05)]
            transition-[border-color,box-shadow] duration-200 ease-out
            hover:border-accent/40
            focus:border-accent focus:shadow-[inset_0_1px_2px_rgba(67,15,28,0.05),0_0_0_4px_rgba(201,162,107,0.22)]
            disabled:cursor-not-allowed disabled:bg-surface disabled:text-muted-foreground disabled:shadow-none
            ${sizeClasses[size]}
            ${className}`}
          {...props}
        >
          {children}
        </select>
        <CaretDown
          size={size === 'sm' ? 12 : 14}
          weight="bold"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
      </div>
    )

    if (!label) return select

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={selectId} className="text-sm font-medium text-foreground">
          {label}
        </label>
        {select}
      </div>
    )
  }
)
Select.displayName = 'Select'
