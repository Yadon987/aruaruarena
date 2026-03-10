import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JUDGE_ENTRANCE } from '../../constants/animations'

const ENTRANCE_DURATION_MS = JUDGE_ENTRANCE.DURATION_MS
const NAKAO_ENTRANCE_DURATION_SEC = JUDGE_ENTRANCE.VARIANTS.nakao.transition.duration

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
    // 何を検証するか: 設定された登場アニメーション時間後に完了と判定されること
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
    expect(result.current.variants.nakao.transition).toMatchObject({
      duration: NAKAO_ENTRANCE_DURATION_SEC,
    })
  })

  it('各審査員がそれぞれ異なる方向から登場する入場アニメーションを持つ', async () => {
    // 何を検証するか: E25-01の受け入れ基準として、審査員ごとに異なる登場演出を持つこと
    const { useJudgeEntrance } = await loadUseJudgeEntrance()
    const { result } = renderHook(() => useJudgeEntrance())

    const hiroyukiInitial = result.current.variants.hiroyuki.initial as { x: number; y: number }
    const dewiInitial = result.current.variants.dewi.initial as { x: number; y: number }
    const nakaoInitial = result.current.variants.nakao.initial as { x: number; y: number }

    expect(hiroyukiInitial.x).toBeLessThan(-50)
    expect(hiroyukiInitial.y).toBeGreaterThan(50)
    expect(dewiInitial.x).toBeGreaterThan(50)
    expect(dewiInitial.y).toBeLessThan(-50)
    expect(nakaoInitial.x).toBeGreaterThan(50)
    expect(nakaoInitial.y).toBeGreaterThan(50)
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
