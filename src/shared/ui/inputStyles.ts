import { cn } from '@/shared/lib/cn'

export function inputStyles(invalid = false): string {
  return cn(
    'h-12 w-full rounded-[2px] border bg-paper px-3.5 text-[0.95rem] text-ink',
    'placeholder:text-field/80',
    'transition focus:border-brand focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand',
    'disabled:cursor-not-allowed disabled:bg-paper-alt disabled:text-text-2',
    invalid ? 'border-danger' : 'border-border-interactive',
  )
}
