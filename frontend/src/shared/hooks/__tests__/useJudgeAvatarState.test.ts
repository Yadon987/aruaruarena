import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AVATAR_ANIMATION } from '../../constants/avatar'
import type { JudgePersona } from '../../types/domain'

const useReducedMotionMock = vi.fn(() => false)

vi.mock('../useReducedMotion', () => ({
  useReducedMotion: () => useReducedMotionMock(),
}))

const loadUseJudgeAvatarState = () => import('../useJudgeAvatarState')

describe('useJudgeAvatarState', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    useReducedMotionMock.mockReturnValue(false)
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('初期状態は全審査員がbase', async () => {
    const { useJudgeAvatarState } = await loadUseJudgeAvatarState()
    const { result } = renderHook(() =>
      useJudgeAvatarState({
        isJudging: true,
        isPostModalOpen: false,
        speakingJudge: null,
      })
    )

    expect(result.current.avatarStates).toEqual({
      hiroyuki: 'base',
      dewi: 'base',
      nakao: 'base',
    })
  })

  it('発話中審査員はmouth_openに遷移し継続時間後にbaseへ戻る', async () => {
    const { useJudgeAvatarState } = await loadUseJudgeAvatarState()
    const { result } = renderHook(
      ({ speakingJudge }) =>
        useJudgeAvatarState({
          isJudging: true,
          isPostModalOpen: false,
          speakingJudge,
        }),
      { initialProps: { speakingJudge: 'dewi' as JudgePersona } }
    )

    await act(async () => {
      vi.advanceTimersByTime(AVATAR_ANIMATION.MOUTH_INTERVAL_MIN_MS)
    })
    expect(result.current.avatarStates.dewi).toBe('mouth_open')

    await act(async () => {
      vi.advanceTimersByTime(AVATAR_ANIMATION.MOUTH_DURATION_MS)
    })
    expect(result.current.avatarStates.dewi).toBe('base')
  })

  it('話者切り替え時に旧話者はbaseへ戻る', async () => {
    const { useJudgeAvatarState } = await loadUseJudgeAvatarState()
    const { result, rerender } = renderHook(
      ({ speakingJudge }) =>
        useJudgeAvatarState({
          isJudging: true,
          isPostModalOpen: false,
          speakingJudge,
        }),
      { initialProps: { speakingJudge: 'dewi' as JudgePersona } }
    )

    await act(async () => {
      vi.advanceTimersByTime(AVATAR_ANIMATION.MOUTH_INTERVAL_MIN_MS)
    })
    expect(result.current.avatarStates.dewi).toBe('mouth_open')

    rerender({ speakingJudge: 'hiroyuki' as JudgePersona })
    expect(result.current.avatarStates.dewi).toBe('base')
  })

  it('瞬きタイミングでeye_closedになり継続時間後にbaseへ戻る', async () => {
    const { useJudgeAvatarState } = await loadUseJudgeAvatarState()
    const { result } = renderHook(() =>
      useJudgeAvatarState({
        isJudging: true,
        isPostModalOpen: false,
        speakingJudge: null,
      })
    )

    await act(async () => {
      vi.advanceTimersByTime(AVATAR_ANIMATION.BLINK_INTERVAL_MIN_MS)
    })

    expect(result.current.avatarStates.hiroyuki).toBe('eye_closed')

    await act(async () => {
      vi.advanceTimersByTime(AVATAR_ANIMATION.BLINK_DURATION_MS)
    })

    expect(result.current.avatarStates.hiroyuki).toBe('base')
  })

  it('発話中は瞬きよりmouth_openを優先する', async () => {
    const { useJudgeAvatarState } = await loadUseJudgeAvatarState()
    const { result } = renderHook(() =>
      useJudgeAvatarState({
        isJudging: true,
        isPostModalOpen: false,
        speakingJudge: 'hiroyuki' as JudgePersona,
      })
    )

    await act(async () => {
      vi.advanceTimersByTime(AVATAR_ANIMATION.BLINK_INTERVAL_MIN_MS)
    })

    expect(result.current.avatarStates.hiroyuki).toBe('mouth_open')
  })

  it('Reduced Motion時は瞬き・口パクを停止する', async () => {
    useReducedMotionMock.mockReturnValue(true)
    const { useJudgeAvatarState } = await loadUseJudgeAvatarState()
    const { result } = renderHook(() =>
      useJudgeAvatarState({
        isJudging: true,
        isPostModalOpen: false,
        speakingJudge: 'nakao',
      })
    )

    await act(async () => {
      vi.advanceTimersByTime(10000)
    })

    expect(result.current.avatarStates).toEqual({
      hiroyuki: 'base',
      dewi: 'base',
      nakao: 'base',
    })
  })
})
