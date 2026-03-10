import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SoundSettingsPanel } from '../SoundSettingsPanel'

describe('E31-01 RED: SoundSettingsPanel', () => {
  it('ESC押下で閉じる', () => {
    // 何を検証するか: パネル表示中のEscキーでonCloseが呼ばれること
    const onClose = vi.fn()

    render(
      <SoundSettingsPanel
        isOpen={true}
        volume={0.5}
        onVolumeChange={vi.fn()}
        onClose={onClose}
        panelId="test-sound-panel"
      />
    )

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('外側クリックで閉じる', () => {
    // 何を検証するか: パネル外クリックでonCloseが呼ばれること
    const onClose = vi.fn()

    render(
      <div>
        <button type="button">outside</button>
        <SoundSettingsPanel
          isOpen={true}
          volume={0.5}
          onVolumeChange={vi.fn()}
          onClose={onClose}
          panelId="test-sound-panel"
        />
      </div>
    )

    fireEvent.mouseDown(screen.getByRole('button', { name: 'outside' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
