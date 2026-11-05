import { forwardRef, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/shared/lib/cn'
import { inputStyles } from './input-styles'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
  options: ReadonlyArray<{ value: string; label: string }>
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, options, placeholder, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(inputStyles(invalid), 'appearance-none pr-10', className)}
        aria-invalid={invalid || undefined}
        {...props}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-text-2"
        aria-hidden="true"
      />
    </div>
  )
})
