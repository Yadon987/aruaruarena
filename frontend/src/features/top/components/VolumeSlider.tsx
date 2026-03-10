import { type RefObject, useId } from 'react'
import './VolumeSlider.css'

export type VolumeSliderProps = {
  id?: string
  value: number
  onChange: (value: number) => void
  inputRef?: RefObject<HTMLInputElement | null>
}

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
  const labelId = `${sliderId}-label`

  return (
    <label className="volume-slider" htmlFor={sliderId}>
      <span id={labelId} className="volume-slider__label">
        音量
      </span>
      <input
        id={sliderId}
        ref={inputRef}
        type="range"
        min={0}
        max={100}
        step={1}
        value={percent}
        onChange={(event) => onChange(clamp01(Number(event.target.value) / 100))}
        className="volume-slider__range"
        aria-labelledby={labelId}
      />
      <span className="volume-slider__value">{percent}%</span>
    </label>
  )
}
