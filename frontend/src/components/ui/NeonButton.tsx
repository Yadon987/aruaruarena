import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type NeonButtonProps = {
  children: ReactNode
  type?: 'button' | 'submit'
  variant?: 'primary' | 'secondary'
  ariaLabel: string
  compactOnMobile?: boolean
  className?: string
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'aria-label' | 'className'>

export const NeonButton = forwardRef<HTMLButtonElement, NeonButtonProps>(function NeonButton(
  {
    children,
    type = 'button',
    variant = 'primary',
    disabled = false,
    ariaLabel,
    compactOnMobile = false,
    className: customClassName,
    ...rest
  },
  ref
) {
  const variantClass = variant === 'secondary' ? 'neon-glow-pink' : 'neon-glow-blue'
  const compactClass = compactOnMobile ? 'neon-button-compact-mobile' : ''
  const className =
    `neon-button-base ${variantClass} ${compactClass} ${customClassName ?? ''}`.trim()

  return (
    <button
      ref={ref}
      type={type}
      aria-label={ariaLabel}
      disabled={disabled}
      className={className}
      {...rest}
    >
      {children}
    </button>
  )
})
