import { cn } from '@/shared/lib/cn'

interface ContainerProps {
  children: React.ReactNode
  className?: string
  size?: 'default' | 'narrow' | 'wide'
}

const sizes = {
  narrow: 'max-w-[760px]',
  default: 'max-w-[1180px]',
  wide: 'max-w-[1320px]',
} as const

export function Container({ children, className, size = 'default' }: ContainerProps) {
  return (
    <div className={cn('mx-auto w-full px-5 sm:px-8', sizes[size], className)}>{children}</div>
  )
}
