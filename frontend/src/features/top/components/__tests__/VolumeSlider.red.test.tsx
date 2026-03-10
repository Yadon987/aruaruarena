import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { VolumeSlider } from '../VolumeSlider'

describe('E31-01 RED: VolumeSlider', () => {
  it('スライダー値を0-1に変換して通知する', () => {
    // 何を検証するか: 30%入力時に0.3へ変換してonChangeへ渡すこと
    const onChange = vi.fn()

    render(<VolumeSlider value={0.5} onChange={onChange} />)
    fireEvent.change(screen.getByRole('slider', { name: '音量' }), {
      target: { value: '30' },
    })

    expect(onChange).toHaveBeenCalledWith(0.3)
  })
})
