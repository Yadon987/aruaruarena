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
      className="neon-button-base neon-glow-pink h-10 w-10 rounded-full p-0 text-lg"
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  )
}
