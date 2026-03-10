import { type RefObject, useEffect, useRef } from 'react'
import { VolumeSlider } from './VolumeSlider'
import './SoundSettingsPanel.css'

export type SoundSettingsPanelProps = {
  isOpen: boolean
  volume: number
  onVolumeChange: (volume: number) => void
  onClose: () => void
  containerRef?: RefObject<HTMLElement | null>
}

export function SoundSettingsPanel({
  isOpen,
  volume,
  onVolumeChange,
  onClose,
  containerRef,
}: SoundSettingsPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!panelRef.current) return
      if (panelRef.current.contains(event.target as Node)) return
      if (containerRef?.current?.contains(event.target as Node)) return
      onClose()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      onClose()
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [containerRef, isOpen, onClose])

  if (!isOpen) return null

  const icon = volume === 0 ? '🔇' : '🔊'

  return (
    <div ref={panelRef} className="sound-settings-panel" role="dialog" aria-label="音声設定パネル">
      <div className="sound-settings-panel__header">
        <span className="sound-settings-panel__icon" aria-hidden="true">
          {icon}
        </span>
        <span className="sound-settings-panel__title">サウンド</span>
      </div>
      <VolumeSlider value={volume} onChange={onVolumeChange} />
    </div>
  )
}
