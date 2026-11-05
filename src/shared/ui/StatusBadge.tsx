import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

const tones: Record<Tone, { badge: string; dot: string }> = {
  neutral: { badge: 'bg-paper-alt text-text-2 border-border', dot: 'bg-field' },
  info: { badge: 'bg-blue-50 text-brand border-blue-200', dot: 'bg-blue-500' },
  success: { badge: 'bg-success-soft text-success border-[#bfe3d0]', dot: 'bg-success' },
  warning: { badge: 'bg-warning-soft text-warning border-[#f0dca4]', dot: 'bg-warning' },
  danger: { badge: 'bg-danger-soft text-danger border-[#f3c2bd]', dot: 'bg-danger' },
}

interface StatusBadgeProps {
  tone?: Tone
  children: ReactNode
  className?: string
}

export function StatusBadge({ tone = 'neutral', children, className }: StatusBadgeProps) {
  const style = tones[tone]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-[2px] border px-2 py-1 text-[0.7rem] font-bold uppercase tracking-[0.08em]',
        style.badge,
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', style.dot)} aria-hidden="true" />
      {children}
    </span>
  )
}
