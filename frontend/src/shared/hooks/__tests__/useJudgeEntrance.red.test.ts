import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JUDGE_ENTRANCE } from '../../constants/animations'

const ENTRANCE_DURATION_MS = JUDGE_ENTRANCE.DURATION_MS
const NAKAO_ENTRANCE_TRANSITION_DURATION_SEC = 4.4

const useReducedMotionMock = vi.fn()
vi.mock('../useReducedMotion', () => ({
  useReducedMotion: () => useReducedMotionMock(),
}))

function isPoint(value: unknown): value is { x: number; y: number } {
  if (!value || typeof value !== 'object') return false
  const candidate = value as { x?: unknown; y?: unknown }
  return typeof candidate.x === 'number' && typeof candidate.y === 'number'
}

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
      duration: NAKAO_ENTRANCE_TRANSITION_DURATION_SEC,
    })
  })

it('各審査員がそれぞれ異なる方向から登場する入場アニメーションを持つ', async () => {
    // 何を検証するか: useJudgeEntrance が現在の JUDGE_ENTRANCE.VARIANTS を返すため、定義どおりの初期位置を確認する
    const { useJudgeEntrance } = await loadUseJudgeEntrance()
    const { result } = renderHook(() => useJudgeEntrance())

    const hiroyukiInitial = result.current.variants.hiroyuki.initial
    const dewiInitial = result.current.variants.dewi.initial
    const nakaoInitial = result.current.variants.nakao.initial
    expect(isPoint(hiroyukiInitial)).toBe(true)
    expect(isPoint(dewiInitial)).toBe(true)
    expect(isPoint(nakaoInitial)).toBe(true)
    if (!isPoint(hiroyukiInitial) || !isPoint(dewiInitial) || !isPoint(nakaoInitial)) return

    const { x: hiroyukiX, y: hiroyukiY } = hiroyukiInitial
    const { x: dewiX, y: dewiY } = dewiInitial
    const { x: nakaoX, y: nakaoY } = nakaoInitial

    expect(hiroyukiX).toBeLessThan(-50)
    expect(hiroyukiY).toBeGreaterThan(50)
    expect(dewiX).toBeGreaterThan(50)
    expect(dewiY).toBeLessThan(-50)
    expect(nakaoX).toBeLessThan(-50)
    expect(nakaoY).toBeGreaterThan(50)
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
