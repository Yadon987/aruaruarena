import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JUDGE_ENTRANCE } from '../../constants/animations'

const ENTRANCE_DURATION_MS = JUDGE_ENTRANCE.DURATION_MS

const useReducedMotionMock = vi.fn()
vi.mock('../useReducedMotion', () => ({
  useReducedMotion: () => useReducedMotionMock(),
}))

const loadUseJudgeEntrance = async () => {
  return import('../useJudgeEntrance')
}

describe('E24-01 RED: useJudgeEntrance', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    useReducedMotionMock.mockReturnValue(false)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('初期状態で hasEntered=false を返す', async () => {
    // 何を検証するか: マウント直後は登場アニメーション未完了状態であること
    const { useJudgeEntrance } = await loadUseJudgeEntrance()
    const { result } = renderHook(() => useJudgeEntrance())

    expect(result.current.hasEntered).toBe(false)
  })

  it(`${ENTRANCE_DURATION_MS}ms 経過で hasEntered=true になる`, async () => {
    // 何を検証するか: 中尾彬風のアニメーション時間（1.2s）後に登場完了と判定されること
    const { useJudgeEntrance } = await loadUseJudgeEntrance()
    const { result } = renderHook(() => useJudgeEntrance())

    expect(result.current.hasEntered).toBe(false)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ENTRANCE_DURATION_MS)
    })

    expect(result.current.hasEntered).toBe(true)
  })

  it('Reduced Motion 時は即座に hasEntered=true になる', async () => {
    // 何を検証するか: アクセシビリティ対応としてアニメーション無効時は即座に完了状態になること
    useReducedMotionMock.mockReturnValue(true)

    const { useJudgeEntrance } = await loadUseJudgeEntrance()
    const { result } = renderHook(() => useJudgeEntrance())

    expect(result.current.hasEntered).toBe(true)
  })

  it('各審査員のバリアントが正しく設定される', async () => {
    // 何を検証するか: hiroyuki/dewi/nakao の各アニメーション設定が返されること
    const { useJudgeEntrance } = await loadUseJudgeEntrance()
    const { result } = renderHook(() => useJudgeEntrance())

    expect(result.current.variants).toHaveProperty('hiroyuki')
    expect(result.current.variants).toHaveProperty('dewi')
    expect(result.current.variants).toHaveProperty('nakao')
    expect(result.current.variants.nakao.transition.duration).toBe(1.2)
  })

  it('3人ともデスク後方からせり上がる入場アニメーションを持つ', async () => {
    // 何を検証するか: E25-01の受け入れ基準として、全審査員の初期位置が y=100 のせり上がり演出に統一されること
    const { useJudgeEntrance } = await loadUseJudgeEntrance()
    const { result } = renderHook(() => useJudgeEntrance())

    expect(result.current.variants.hiroyuki.initial.y).toBe(100)
    expect(result.current.variants.dewi.initial.y).toBe(100)
    expect(result.current.variants.nakao.initial.y).toBe(100)
  })

  it('アンマウント時にタイマーがクリアされる', async () => {
    // 何を検証するか: メモリリーク防止のためクリーンアップ関数が動作すること
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
    const { useJudgeEntrance } = await loadUseJudgeEntrance()
    const { unmount } = renderHook(() => useJudgeEntrance())

    unmount()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })

    expect(clearTimeoutSpy).toHaveBeenCalled()
    clearTimeoutSpy.mockRestore()
  })
})
