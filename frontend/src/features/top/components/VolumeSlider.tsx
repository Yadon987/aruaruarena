import { type RefObject, useId } from 'react'
import './VolumeSlider.css'

export type VolumeSliderProps = {
  id?: string
  value: number
  onChange: (value: number) => void
  inputRef?: RefObject<HTMLInputElement | null>
}

const VOLUME_LABEL = '音量'

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

export function VolumeSlider({ id, value, onChange, inputRef }: VolumeSliderProps) {
  const clamped = clamp01(value)
  const percent = Math.round(clamped * 100)
  const generatedId = useId().replace(/:/g, '')
  const sliderId = id ?? `sound-volume-slider-${generatedId}`

  return (
    <label className="volume-slider">
      <span className="volume-slider__label">
        {VOLUME_LABEL}
      </span>
      <input
        id={sliderId}
        ref={inputRef}
        type="range"
        min={0}
        max={100}
        step={1}
        value={percent}
        aria-label={VOLUME_LABEL}
        onChange={(event) => onChange(clamp01(Number(event.target.value) / 100))}
        className="volume-slider__range"
      />
      <span className="volume-slider__value">{percent}%</span>
    </label>
  )
}
