import { type RefObject, useEffect, useRef } from 'react'
import { VolumeSlider } from './VolumeSlider'
import './SoundSettingsPanel.css'

export type SoundSettingsPanelProps = {
  isOpen: boolean
  volume: number
  onVolumeChange: (volume: number) => void
  onClose: () => void
  panelId: string
  containerRef?: RefObject<HTMLElement | null>
}

export function SoundSettingsPanel({
  isOpen,
  volume,
  onVolumeChange,
  onClose,
  panelId,
  containerRef,
}: SoundSettingsPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const sliderRef = useRef<HTMLInputElement | null>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!isOpen) return

    const handleMouseDown = (event: MouseEvent) => {
      if (!panelRef.current) return
      if (panelRef.current.contains(event.target as Node)) return
      if (containerRef?.current?.contains(event.target as Node)) return
      onCloseRef.current()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      onCloseRef.current()
    }

    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [containerRef, isOpen])

  useEffect(() => {
    if (!isOpen) return
    sliderRef.current?.focus()
  }, [isOpen])

  if (!isOpen) return null

  const icon = volume === 0 ? '🔇' : '🔊'

  return (
    <div
      id={panelId}
      ref={panelRef}
      className="sound-settings-panel"
      role="dialog"
      aria-label="音声設定パネル"
    >
      <div className="sound-settings-panel__header">
        <span className="sound-settings-panel__icon" aria-hidden="true">
          {icon}
        </span>
        <span className="sound-settings-panel__title">サウンド</span>
      </div>
      <VolumeSlider
        id={`${panelId}-volume`}
        value={volume}
        onChange={onVolumeChange}
        inputRef={sliderRef}
      />
    </div>
  )
}
