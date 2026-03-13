import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const loadUseJudgeSpeech = async () => {
  return import('../useJudgeSpeech')
}

describe('useJudgeSpeech Refactor', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.doUnmock('../../constants/judgePhrases')
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('isJudging: true -> false -> true で発話を再開できる', async () => {
    const { useJudgeSpeech } = await loadUseJudgeSpeech()
    const { result, rerender } = renderHook(
      ({ isJudging, isPostModalOpen }) => useJudgeSpeech({ isJudging, isPostModalOpen }),
      { initialProps: { isJudging: true, isPostModalOpen: false } }
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(result.current.currentSpeech).not.toBeNull()

    rerender({ isJudging: false, isPostModalOpen: false })
    expect(result.current.currentSpeech).toBeNull()

    rerender({ isJudging: true, isPostModalOpen: false })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(result.current.currentSpeech).not.toBeNull()
  })

  it('口癖配列が1件でもクラッシュせず発話できる', async () => {
    vi.doMock('../../constants/judgePhrases', () => ({
      JUDGES: ['hiroyuki', 'dewi', 'nakao'],
      JUDGE_PHRASES: {
        hiroyuki: ['A'],
        dewi: ['B'],
        nakao: ['C'],
      },
      JUDGE_LOW_SCORE_PHRASES: {
        hiroyuki: ['A'],
        dewi: ['B'],
        nakao: ['C'],
      },
    }))

    const { useJudgeSpeech } = await import('../useJudgeSpeech')
    const { result } = renderHook(() => useJudgeSpeech({ isJudging: true, isPostModalOpen: false }))

    // 間隔が0〜500msなので、1000ms進めれば確実に発話が開始される
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })

    expect(['A', 'B', 'C']).toContain(result.current.currentSpeech)
  })

  it('審査員が1人でも同じ審査員で継続できる', async () => {
    vi.doMock('../../constants/judgePhrases', () => ({
      JUDGES: ['hiroyuki'],
      JUDGE_PHRASES: {
        hiroyuki: ['A', 'B'],
      },
      JUDGE_LOW_SCORE_PHRASES: {
        hiroyuki: ['A'],
      },
    }))

    const { useJudgeSpeech } = await import('../useJudgeSpeech')
    const { result } = renderHook(() => useJudgeSpeech({ isJudging: true, isPostModalOpen: false }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    const firstJudge = result.current.speakingJudge

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3500)
    })
    const secondJudge = result.current.speakingJudge

    expect(firstJudge).toBe('hiroyuki')
    expect(secondJudge).toBe('hiroyuki')
  })

  it('発話間隔は最小0ms〜最大500msの範囲内になる', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.4)
    const { useJudgeSpeech } = await loadUseJudgeSpeech()

    renderHook(() => useJudgeSpeech({ isJudging: true, isPostModalOpen: false }))

    expect(setTimeoutSpy.mock.calls.length).toBeGreaterThan(0)

    const delays = setTimeoutSpy.mock.calls
      .map((call) => call[1])
      .filter((delay): delay is number => typeof delay === 'number')

    delays.forEach((delay) => {
      expect(delay).toBeGreaterThanOrEqual(0)
      expect(delay).toBeLessThanOrEqual(500)
    })

    randomSpy.mockRestore()
  })

  it('全審査員からランダム選択される', async () => {
    const { useJudgeSpeech } = await loadUseJudgeSpeech()
    const { result } = renderHook(() => useJudgeSpeech({ isJudging: true, isPostModalOpen: false }))
    const picked = new Set<string>()

    // 間隔が0〜500ms + 表示時間2500msなので、1サイクル最大3000ms
    // 20回ループで70秒分進める（統計的に全員選ばれる可能性が高い）
    for (let i = 0; i < 20; i += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3500)
      })
      if (result.current.speakingJudge) {
        picked.add(result.current.speakingJudge)
      }
    }

    expect(picked).toEqual(new Set(['hiroyuki', 'dewi', 'nakao']))
  })
})
