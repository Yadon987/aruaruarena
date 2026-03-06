import type { ButtonHTMLAttributes, ReactNode } from 'react'

type NeonButtonProps = {
  children: ReactNode
  type?: 'button' | 'submit'
  variant?: 'primary' | 'secondary'
  ariaLabel: string
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'aria-label' | 'className'>

export function NeonButton({
  children,
  type = 'button',
  variant = 'primary',
  disabled = false,
  ariaLabel,
  ...rest
}: NeonButtonProps) {
  const variantClass = variant === 'secondary' ? 'neon-glow-pink' : 'neon-glow-blue'

  return (
    <button
      type={type}
      aria-label={ariaLabel}
      disabled={disabled}
      className={variantClass}
      {...rest}
    >
      {children}
    </button>
  )
}
