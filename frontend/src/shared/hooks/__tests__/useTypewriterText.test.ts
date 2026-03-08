import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const useReducedMotionMock = vi.fn(() => false)

vi.mock('../useReducedMotion', () => ({
  useReducedMotion: () => useReducedMotionMock(),
}))

const loadUseTypewriterText = () => import('../useTypewriterText')

describe('useTypewriterText', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useReducedMotionMock.mockReturnValue(false)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('表示中は30msごとに1文字ずつ増える', async () => {
    const { useTypewriterText } = await loadUseTypewriterText()
    const { result } = renderHook(() =>
      useTypewriterText({
        text: 'テスト',
        isVisible: true,
        baseIntervalMs: 30,
        maxDurationMs: 2500,
      })
    )

    expect(result.current).toBe('テ')

    await act(async () => {
      vi.advanceTimersByTime(30)
    })
    expect(result.current).toBe('テス')

    await act(async () => {
      vi.advanceTimersByTime(30)
    })
    expect(result.current).toBe('テスト')
  })

  it('非表示時はテキストを空に戻す', async () => {
    const { useTypewriterText } = await loadUseTypewriterText()
    const { result, rerender } = renderHook(
      ({ isVisible }) =>
        useTypewriterText({
          text: 'あいうえお',
          isVisible,
          baseIntervalMs: 30,
          maxDurationMs: 2500,
        }),
      { initialProps: { isVisible: true } }
    )

    expect(result.current).toBe('あ')

    rerender({ isVisible: false })
    expect(result.current).toBe('')
  })

  it('Reduced Motion時は即時全文表示する', async () => {
    useReducedMotionMock.mockReturnValue(true)
    const { useTypewriterText } = await loadUseTypewriterText()
    const { result } = renderHook(() =>
      useTypewriterText({
        text: 'それってあなたの感想ですよね',
        isVisible: true,
        baseIntervalMs: 30,
        maxDurationMs: 2500,
      })
    )

    expect(result.current).toBe('それってあなたの感想ですよね')
  })

  it('長文でもmaxDuration内に全文表示する', async () => {
    const { useTypewriterText } = await loadUseTypewriterText()
    const text = 'あ'.repeat(120)
    const { result } = renderHook(() =>
      useTypewriterText({
        text,
        isVisible: true,
        baseIntervalMs: 30,
        maxDurationMs: 200,
      })
    )

    expect(result.current.length).toBe(1)

    await act(async () => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current).toBe(text)
  })
})
