import type { ReactNode } from 'react'

type NeonButtonProps = {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  variant?: 'primary' | 'secondary'
  disabled?: boolean
  ariaLabel: string
}

export function NeonButton({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  disabled = false,
  ariaLabel,
}: NeonButtonProps) {
  const variantClass = variant === 'secondary' ? 'neon-glow-pink' : 'neon-glow-blue'

  return (
    <button
      type={type}
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      className={variantClass}
    >
      {children}
    </button>
  )
}
