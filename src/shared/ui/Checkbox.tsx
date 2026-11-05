import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode
  description?: ReactNode
  invalid?: boolean
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, className, invalid, id, ...props },
  ref,
) {
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <input
        ref={ref}
        id={id}
        type="checkbox"
        className={cn(
          'mt-0.5 size-5 shrink-0 cursor-pointer rounded-[2px] border accent-brand',
          invalid ? 'border-danger' : 'border-border-interactive',
        )}
        aria-invalid={invalid || undefined}
        {...props}
      />
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="cursor-pointer text-[0.9rem] leading-relaxed text-ink">
          {label}
        </label>
        {description ? (
          <p className="text-[0.78rem] leading-relaxed text-text-2">{description}</p>
        ) : null}
      </div>
    </div>
  )
})
