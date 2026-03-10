import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AudioConsentModal } from '../AudioConsentModal'

const CONSENT_VOLUME = 0.6
const MUTED_VOLUME = 0

describe('E31-01 RED: AudioConsentModal', () => {
  it('「はい」選択で0.6を返す', async () => {
    // 何を検証するか: 同意時に初期ボリューム0.6が返ること
    const onConsent = vi.fn()

    render(<AudioConsentModal isOpen={true} onConsent={onConsent} />)
    await userEvent.click(screen.getByRole('button', { name: 'はい' }))

    expect(onConsent).toHaveBeenCalledTimes(1)
    expect(onConsent).toHaveBeenCalledWith(CONSENT_VOLUME)
  })

  it('「いいえ」選択で0を返す', async () => {
    // 何を検証するか: 拒否時にボリューム0が返ること
    const onConsent = vi.fn()

    render(<AudioConsentModal isOpen={true} onConsent={onConsent} />)
    await userEvent.click(screen.getByRole('button', { name: 'いいえ' }))

    expect(onConsent).toHaveBeenCalledTimes(1)
    expect(onConsent).toHaveBeenCalledWith(MUTED_VOLUME)
  })
})
