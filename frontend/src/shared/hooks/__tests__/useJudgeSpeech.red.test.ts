import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { JUDGE_SPEECH } from '../../constants/animations'

const SPEECH_DURATION_MS = JUDGE_SPEECH.DURATION_MS

const loadUseJudgeSpeech = async () => {
  return import('../useJudgeSpeech')
}

describe('E24-03 RED: useJudgeSpeech', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('isJudging=false では発話しない', async () => {
    // 何を検証するか: 審査中でない場合は口癖が表示されないこと
    const { useJudgeSpeech } = await loadUseJudgeSpeech()
    const { result } = renderHook(() =>
      useJudgeSpeech({ isJudging: false, isPostModalOpen: false })
    )

    expect(result.current.currentSpeech).toBeNull()
    expect(result.current.speakingJudge).toBeNull()
  })

  it('isPostModalOpen=true では発話しない', async () => {
    // 何を検証するか: 投稿モーダルオープン中は口癖が表示されないこと（FR-09）
    const { useJudgeSpeech } = await loadUseJudgeSpeech()
    const { result } = renderHook(() => useJudgeSpeech({ isJudging: true, isPostModalOpen: true }))

    expect(result.current.currentSpeech).toBeNull()
    expect(result.current.speakingJudge).toBeNull()
  })

  it('isJudging=true && !isPostModalOpen でランダム間隔後に発話開始', async () => {
    // 何を検証するか: 審査中かつモーダル閉じ状態で口癖発話が開始されること
    const { useJudgeSpeech } = await loadUseJudgeSpeech()
    const { result } = renderHook(() => useJudgeSpeech({ isJudging: true, isPostModalOpen: false }))

    expect(result.current.currentSpeech).toBeNull()

    // 間隔が0〜500msなので、1000ms進めれば確実に発話が開始される
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })

    expect(result.current.speakingJudge).not.toBeNull()
    expect(result.current.currentSpeech).not.toBeNull()
  })

  it('SPEECH_DURATION_MS 後に発話終了', async () => {
    // 何を検証するか: 口癖表示時間（2.5s）後に発話が終了すること
    const { useJudgeSpeech } = await loadUseJudgeSpeech()
    const { result } = renderHook(() => useJudgeSpeech({ isJudging: true, isPostModalOpen: false }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000)
    })
    expect(result.current.currentSpeech).not.toBeNull()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SPEECH_DURATION_MS)
    })
    expect(result.current.currentSpeech).toBeNull()
  })

  it('同一審査員の連続選択は許容される', async () => {
    // 何を検証するか: 同じ審査員が連続して選ばれる可能性があること（FR-10）
    const { useJudgeSpeech } = await loadUseJudgeSpeech()
    const randomSpy = vi.spyOn(Math, 'random')
    randomSpy.mockReturnValue(0.1)

    const { result } = renderHook(() => useJudgeSpeech({ isJudging: true, isPostModalOpen: false }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000)
    })
    const firstJudge = result.current.speakingJudge

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SPEECH_DURATION_MS + 1000)
    })
    const secondJudge = result.current.speakingJudge

    expect([firstJudge, secondJudge]).toContain('hiroyuki')
    randomSpy.mockRestore()
  })

  it('同じセリフは連続して選ばれない', async () => {
    // 何を検証するか: FR-10 - 同一審査員でも前回と異なるセリフが表示されること
    const { useJudgeSpeech } = await loadUseJudgeSpeech()
    const { result } = renderHook(() => useJudgeSpeech({ isJudging: true, isPostModalOpen: false }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000)
    })
    const firstSpeech = result.current.currentSpeech

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SPEECH_DURATION_MS + 1000)
    })
    const secondSpeech = result.current.currentSpeech

    expect(secondSpeech).not.toBe(firstSpeech)
  })

  it('アンマウント時にタイマーがクリアされる', async () => {
    // 何を検証するか: NFR-03 - メモリリーク防止のためタイマーがクリアされること
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
    const { useJudgeSpeech } = await loadUseJudgeSpeech()
    const { unmount } = renderHook(() =>
      useJudgeSpeech({ isJudging: true, isPostModalOpen: false })
    )

    unmount()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000)
    })

    expect(clearTimeoutSpy).toHaveBeenCalled()
    clearTimeoutSpy.mockRestore()
  })
})
