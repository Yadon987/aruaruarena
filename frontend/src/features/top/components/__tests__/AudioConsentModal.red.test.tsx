import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AudioConsentModal } from '../AudioConsentModal'

describe('E31-01 RED: AudioConsentModal', () => {
  it('「はい」選択で0.6を返す', () => {
    // 何を検証するか: 同意時に初期ボリューム0.6が返ること
    const onConsent = vi.fn()

    render(<AudioConsentModal isOpen={true} onConsent={onConsent} />)
    fireEvent.click(screen.getByRole('button', { name: 'はい' }))

    expect(onConsent).toHaveBeenCalledWith(0.6)
  })

  it('「いいえ」選択で0を返す', () => {
    // 何を検証するか: 拒否時にボリューム0が返ること
    const onConsent = vi.fn()

    render(<AudioConsentModal isOpen={true} onConsent={onConsent} />)
    fireEvent.click(screen.getByRole('button', { name: 'いいえ' }))

    expect(onConsent).toHaveBeenCalledWith(0)
  })
})
