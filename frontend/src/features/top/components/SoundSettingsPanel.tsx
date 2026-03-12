import { type CSSProperties, type RefObject, useEffect, useRef, useState } from 'react'
import { VolumeSlider } from './VolumeSlider'
import './SoundSettingsPanel.css'

const LOW_VOLUME_ICON_THRESHOLD = 0.34
const HIGH_VOLUME_ICON_THRESHOLD = 0.67

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
  const openerElementRef = useRef<HTMLElement | null>(null)
  const [horizontalShift, setHorizontalShift] = useState(0)

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
    if (isOpen) {
      openerElementRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null
      sliderRef.current?.focus()
      return () => {
        if (openerElementRef.current && document.body.contains(openerElementRef.current)) {
          openerElementRef.current.focus()
        }
        openerElementRef.current = null
      }
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      setHorizontalShift(0)
      return
    }

    const adjustPositionWithinViewport = () => {
      const panel = panelRef.current
      if (!panel) return

      const viewportMargin = 8
      const rect = panel.getBoundingClientRect()
      let shift = 0

      if (rect.left < viewportMargin) {
        shift += viewportMargin - rect.left
      }
      if (rect.right > window.innerWidth - viewportMargin) {
        shift -= rect.right - (window.innerWidth - viewportMargin)
      }

      setHorizontalShift(shift)
    }

    const rafId = window.requestAnimationFrame(adjustPositionWithinViewport)
    window.addEventListener('resize', adjustPositionWithinViewport)
    window.addEventListener('orientationchange', adjustPositionWithinViewport)

    return () => {
      window.cancelAnimationFrame(rafId)
      window.removeEventListener('resize', adjustPositionWithinViewport)
      window.removeEventListener('orientationchange', adjustPositionWithinViewport)
    }
  }, [isOpen])

  if (!isOpen) return null

  const icon = (() => {
    if (volume <= 0) return '🔇'
    if (volume < LOW_VOLUME_ICON_THRESHOLD) return '🔈'
    if (volume < HIGH_VOLUME_ICON_THRESHOLD) return '🔉'
    return '🔊'
  })()

  const panelStyle = {
    '--sound-settings-shift-x': `${horizontalShift}px`,
  } as CSSProperties

  return (
    <div
      id={panelId}
      ref={panelRef}
      className="sound-settings-panel"
      style={panelStyle}
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
