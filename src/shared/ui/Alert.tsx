import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import { cn } from '@/shared/lib/cn'
import type { Tone } from './StatusBadge'

const styles: Record<Tone, { wrapper: string; icon: typeof Info }> = {
  neutral: { wrapper: 'border-border bg-paper-alt text-text-2', icon: Info },
  info: { wrapper: 'border-blue-200 bg-blue-50 text-brand', icon: Info },
  success: { wrapper: 'border-[#bfe3d0] bg-success-soft text-success', icon: CheckCircle2 },
  warning: { wrapper: 'border-[#f0dca4] bg-warning-soft text-warning', icon: AlertTriangle },
  danger: { wrapper: 'border-[#f3c2bd] bg-danger-soft text-danger', icon: XCircle },
}

interface AlertProps {
  tone?: Tone
  title?: string
  children: ReactNode
  className?: string
}

export function Alert({ tone = 'info', title, children, className }: AlertProps) {
  const style = styles[tone]
  const Icon = style.icon

  return (
    <div className={cn('flex gap-3 rounded-[2px] border p-4', style.wrapper, className)} role="status">
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="flex flex-col gap-1 text-[0.88rem] leading-relaxed">
        {title ? <p className="font-bold">{title}</p> : null}
        <div>{children}</div>
      </div>
    </div>
  )
}
