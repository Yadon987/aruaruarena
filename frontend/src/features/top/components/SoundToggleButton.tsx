export type SoundToggleButtonProps = {
  isMuted: boolean
  onToggle: () => void
}

export function SoundToggleButton({ isMuted, onToggle }: SoundToggleButtonProps) {
  return (
    <button type="button" onClick={onToggle}>
      {isMuted ? '音声OFF' : '音声ON'}
    </button>
  )
}
