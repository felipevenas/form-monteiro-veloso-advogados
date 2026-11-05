import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'min-h-28 w-full rounded-[2px] border bg-paper px-3.5 py-3 text-[0.95rem] text-ink',
        'placeholder:text-field/80',
        'transition focus:border-brand focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand',
        invalid ? 'border-danger' : 'border-border-interactive',
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  )
})
