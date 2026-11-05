import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'
import { inputStyles } from './input-styles'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(inputStyles(invalid), className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  )
})
