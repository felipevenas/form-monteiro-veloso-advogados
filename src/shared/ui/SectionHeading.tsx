import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

interface SectionHeadingProps {
  eyebrow?: string
  title: string
  description?: string
  as?: 'h1' | 'h2' | 'h3'
  className?: string
  children?: ReactNode
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  as: Tag = 'h2',
  className,
  children,
}: SectionHeadingProps) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {eyebrow ? <p className="label-caps text-blue-600">{eyebrow}</p> : null}
      <Tag className="text-balance text-[2rem] leading-[1.05] text-ink sm:text-[2.5rem]">
        {title}
      </Tag>
      {description ? (
        <p className="max-w-[62ch] text-[0.98rem] leading-relaxed text-text-2">{description}</p>
      ) : null}
      {children}
    </div>
  )
}
