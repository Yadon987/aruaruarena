import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AVATAR_ANIMATION } from '../../constants/avatar'
import { useJudgeAvatar } from '../useJudgeAvatar'

const { useReducedMotionMock } = vi.hoisted(() => ({
  useReducedMotionMock: vi.fn(() => false),
}))

vi.mock('../useReducedMotion', () => ({
  useReducedMotion: useReducedMotionMock,
}))

class MockImage {
  public onload: null | (() => void) = null
  public onerror: null | (() => void) = null
  private imageSrc = ''

  set src(value: string) {
    this.imageSrc = value
  }

  get src() {
    return this.imageSrc
  }
}

describe('E23-01 RED: useJudgeAvatar', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useReducedMotionMock.mockReturnValue(false)
    vi.stubGlobal('Image', MockImage)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('初期状態で base 画像を返す', async () => {
    // 何を検証するか: 審査開始直後は通常表情の base 状態から表示されること
    const { result } = renderHook(() => useJudgeAvatar('hiroyuki', false))

    expect(result.current.currentState).toBe('base')
    expect(result.current.currentImage).toBe('/images/hiroyuki_base.png')
  })

  it('isSpeaking=true のときに口パクが始まり終了後に base に戻る', async () => {
    // 何を検証するか: 発話中のみ口パクし、継続時間経過後に base へ戻ること
    const { result, rerender } = renderHook(
      ({ isSpeaking }) => useJudgeAvatar('hiroyuki', isSpeaking),
      { initialProps: { isSpeaking: false } }
    )

    rerender({ isSpeaking: true })

    await act(async () => {
      vi.advanceTimersByTime(AVATAR_ANIMATION.MOUTH_INTERVAL_MIN_MS)
    })

    expect(result.current.currentState).toBe('mouth_open')

    await act(async () => {
      vi.advanceTimersByTime(AVATAR_ANIMATION.MOUTH_DURATION_MS)
    })

    expect(result.current.currentState).toBe('base')
  })

  it('瞬きが口パクより優先される', async () => {
    // 何を検証するか: 瞬きタイミングと発話が重なっても eye_closed が優先されること
    const { result } = renderHook(({ isSpeaking }) => useJudgeAvatar('dewi', isSpeaking), {
      initialProps: { isSpeaking: true },
    })

    await act(async () => {
      vi.advanceTimersByTime(AVATAR_ANIMATION.BLINK_INTERVAL_MIN_MS)
    })

    expect(result.current.currentState).toBe('eye_closed')
  })

  it('Reduced Motion 時はアニメーションを停止する', async () => {
    // 何を検証するか: prefers-reduced-motion 有効時はタイマー起因の状態遷移が発生しないこと
    useReducedMotionMock.mockReturnValue(true)

    const { result } = renderHook(() => useJudgeAvatar('nakao', true))

    await act(async () => {
      vi.advanceTimersByTime(5000)
    })

    expect(result.current.currentState).toBe('base')
  })
})
