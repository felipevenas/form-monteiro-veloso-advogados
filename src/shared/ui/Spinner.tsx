import { Loader2 } from 'lucide-react'
import { cn } from '@/shared/lib/cn'

export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      className={cn('size-5 animate-spin text-brand', className)}
      aria-hidden="true"
    />
  )
}

export function LoadingBlock({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-text-2" role="status">
      <Spinner />
      <span>{label}</span>
    </div>
  )
}
