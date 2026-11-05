import { Link } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'
import { brand } from '@/shared/config/brand'

interface LogoProps {
  className?: string
  light?: boolean
  to?: string
}

export function Logo({ className, light = false, to = '/' }: LogoProps) {
  return (
    <Link
      to={to}
      className={cn('inline-flex items-center', className)}
    >
      <span
        className={cn(
          'logo-mark h-10 w-[56px] shrink-0',
          light ? 'text-white' : 'text-ink',
        )}
        aria-hidden="true"
      />
      <span className="sr-only">{brand.name} — início</span>
    </Link>
  )
}
