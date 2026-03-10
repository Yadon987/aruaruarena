export type SoundControlButtonProps = {
  volume: number
  isOpen: boolean
  onClick: () => void
}

export function SoundControlButton({ volume, isOpen, onClick }: SoundControlButtonProps) {
  const isMuted = volume === 0
  const icon = isMuted ? '🔇' : '🔊'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="音声設定"
      aria-expanded={isOpen}
      title={isOpen ? '音量パネルを閉じる' : '音量パネルを開く'}
      className="neon-button-base neon-glow-pink icon-action-button"
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  )
}
