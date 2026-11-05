import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import {
  buttonStyles,
  type ButtonSize,
  type ButtonVariant,
} from './button-styles'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    leftIcon,
    rightIcon,
    className,
    children,
    disabled,
    type = 'button',
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonStyles(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  )
})

interface LinkButtonProps {
  to?: string
  href?: string
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  children: ReactNode
  target?: string
  rel?: string
  download?: boolean
}

export function LinkButton({
  to,
  href,
  variant = 'primary',
  size = 'md',
  className,
  leftIcon,
  rightIcon,
  children,
  target,
  rel,
  download,
}: LinkButtonProps) {
  const classes = buttonStyles(variant, size, className)

  if (to) {
    return (
      <Link to={to} className={classes}>
        {leftIcon}
        {children}
        {rightIcon}
      </Link>
    )
  }

  const isExternal = href?.startsWith('http')
  return (
    <a
      href={href}
      className={classes}
      target={target ?? (isExternal ? '_blank' : undefined)}
      rel={rel ?? (isExternal && target !== '_self' ? 'noreferrer' : undefined)}
      download={download}
    >
      {leftIcon}
      {children}
      {rightIcon}
    </a>
  )
}
