import { cn } from '@/shared/lib/cn'

export type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger' | 'light'
export type ButtonSize = 'sm' | 'md' | 'lg'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-white hover:bg-navy-800 disabled:bg-field',
  outline:
    'border border-border-interactive bg-transparent text-brand hover:bg-blue-50 disabled:text-field',
  ghost: 'bg-transparent text-brand hover:bg-blue-50 disabled:text-field',
  danger: 'bg-danger text-white hover:bg-[#8f1c13] disabled:bg-field',
  light: 'bg-white text-ink hover:bg-blue-50 disabled:text-field',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-10 px-4 text-[0.82rem]',
  md: 'min-h-12 px-5 text-sm',
  lg: 'min-h-13 px-6 text-[0.95rem]',
}

export function buttonStyles(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className?: string,
): string {
  return cn(
    'inline-flex items-center justify-center gap-2.5 rounded-[2px] font-bold leading-none tracking-[0.01em] transition duration-200',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
    'disabled:cursor-not-allowed disabled:opacity-60',
    variants[variant],
    sizes[size],
    className,
  )
}
