export type SoundToggleButtonProps = {
  isMuted: boolean
  onToggle: () => void
  className?: string
}

export function SoundToggleButton({ isMuted, onToggle, className }: SoundToggleButtonProps) {
  return (
    <button type="button" onClick={onToggle} aria-pressed={!isMuted} className={className}>
      {isMuted ? '音声OFF' : '音声ON'}
    </button>
  )
}
