import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const loadJudgeAvatar = async () => {
  const modulePath = '../components/JudgeAvatar'
  return import(modulePath)
}

describe('E23-01 RED: JudgeAvatar', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('初期表示で base 画像と alt 属性を描画する', async () => {
    // 何を検証するか: スクリーンリーダー向けの alt を持つ base 画像が初期表示されること
    const { JudgeAvatar } = await loadJudgeAvatar()

    render(<JudgeAvatar persona="hiroyuki" isSpeaking={false} />)

    const image = screen.getByRole('img', { name: /ひろゆき風/ })
    expect(image).toHaveAttribute('src', '/images/hiroyuki_base.png')
  })

  it('isSpeaking=true のとき mouth_open 表示へ切り替わる', async () => {
    // 何を検証するか: 発話中に口パク用画像へ切り替わること
    const { JudgeAvatar } = await loadJudgeAvatar()

    render(<JudgeAvatar persona="dewi" isSpeaking />)

    await act(async () => {
      vi.advanceTimersByTime(2000)
    })

    const speakingImage = screen.getByRole('img', { hidden: true })
    expect(speakingImage).toHaveAttribute('aria-hidden', 'true')
    expect(speakingImage).toHaveAttribute('src', '/images/dewi_mouth_open.png')
  })

  it('瞬き時は eye_closed が優先表示される', async () => {
    // 何を検証するか: 瞬きと口パクが競合した場合に eye_closed が優先されること
    const { JudgeAvatar } = await loadJudgeAvatar()

    render(<JudgeAvatar persona="nakao" isSpeaking />)

    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    const blinkingImage = screen.getByRole('img', { hidden: true })
    expect(blinkingImage).toHaveAttribute('aria-hidden', 'true')
    expect(blinkingImage).toHaveAttribute('src', '/images/nakao_eye_closed.png')
  })
})
