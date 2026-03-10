import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useScoreRoulette } from '../useScoreRoulette'

describe('useScoreRoulette', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('scoringフェーズでは60msごとに2桁数値が切り替わる', async () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.55)
      .mockReturnValueOnce(0.9)

    const { result } = renderHook(() =>
      useScoreRoulette({
        phase: 'scoring',
        finalScoreLabel: '88',
        prefersReducedMotion: false,
      })
    )

    expect(result.current.displayValue).toMatch(/^\d{2}$/)

    await act(async () => {
      vi.advanceTimersByTime(60)
    })
    const firstValue = result.current.displayValue

    await act(async () => {
      vi.advanceTimersByTime(60)
    })
    const secondValue = result.current.displayValue

    expect(firstValue).toMatch(/^\d{2}$/)
    expect(secondValue).toMatch(/^\d{2}$/)
    expect(secondValue).not.toBe(firstValue)
  })

  it('completeフェーズで最終スコアに停止しrevealedになる', async () => {
    type ScorePhase = 'entrance' | 'speaking' | 'scoring' | 'complete'
    const { result, rerender } = renderHook(
      ({ phase }) =>
        useScoreRoulette({
          phase,
          finalScoreLabel: '92',
          prefersReducedMotion: false,
        }),
      { initialProps: { phase: 'scoring' as ScorePhase } }
    )

    rerender({ phase: 'complete' as ScorePhase })
    expect(result.current.displayValue).toBe('92')
    expect(result.current.isRouletting).toBe(false)
    expect(result.current.isRevealed).toBe(true)

    await act(async () => {
      vi.advanceTimersByTime(400)
    })
    expect(result.current.isRevealed).toBe(false)
  })

  it('reduced motion時はscoringでも即時に最終スコアを表示する', () => {
    const { result } = renderHook(() =>
      useScoreRoulette({
        phase: 'scoring',
        finalScoreLabel: '77',
        prefersReducedMotion: true,
      })
    )

    expect(result.current.displayValue).toBe('77')
    expect(result.current.isRouletting).toBe(false)
    expect(result.current.isRevealed).toBe(false)
  })

  it('isFailed時はN/Aを表示しルーレットを停止する', () => {
    const { result } = renderHook(() =>
      useScoreRoulette({
        phase: 'scoring',
        finalScoreLabel: '88',
        isFailed: true,
        prefersReducedMotion: false,
      })
    )

    expect(result.current.displayValue).toBe('N/A')
    expect(result.current.isRouletting).toBe(false)
    expect(result.current.isRevealed).toBe(false)
  })
})
