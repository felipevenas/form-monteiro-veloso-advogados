import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

interface FieldProps {
  id: string
  label: string
  required?: boolean
  hint?: string
  error?: string
  children: ReactNode
  className?: string
}

export function Field({ id, label, required, hint, error, children, className }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[0.82rem] font-bold text-ink">
        {label}
        {required ? (
          <span className="ml-1 text-danger" aria-hidden="true">
            *
          </span>
        ) : (
          <span className="ml-2 text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-field">
            opcional
          </span>
        )}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-[0.78rem] leading-relaxed text-text-2">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-[0.78rem] font-semibold text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
