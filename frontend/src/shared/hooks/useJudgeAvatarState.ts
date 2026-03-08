import { useEffect, useRef, useState } from 'react'
import { AVATAR_ANIMATION, type AvatarState } from '../constants/avatar'
import { JUDGE } from '../constants/validation'
import type { JudgePersona } from '../types/domain'
import { useReducedMotion } from './useReducedMotion'

type AvatarStateMap = Record<JudgePersona, AvatarState>
type TimerMap = Record<JudgePersona, ReturnType<typeof setTimeout> | null>

interface UseJudgeAvatarStateOptions {
  isJudging: boolean
  isPostModalOpen: boolean
  speakingJudge: JudgePersona | null
}

interface JudgeAvatarStateResult {
  avatarStates: AvatarStateMap
}

const INITIAL_AVATAR_STATES: AvatarStateMap = {
  hiroyuki: 'base',
  dewi: 'base',
  nakao: 'base',
}

const createTimerMap = (): TimerMap => ({
  hiroyuki: null,
  dewi: null,
  nakao: null,
})

const getRandomInterval = (minMs: number, maxMs: number): number => {
  return minMs + Math.random() * (maxMs - minMs)
}

const clearTimer = (timer: ReturnType<typeof setTimeout> | null): null => {
  if (timer) {
    clearTimeout(timer)
  }
  return null
}

const clearJudgeTimerMap = (timerMap: TimerMap) => {
  JUDGE.PERSONAS.forEach((judge) => {
    timerMap[judge] = clearTimer(timerMap[judge])
  })
}

/**
 * 審査員アバターの口パク・瞬きを制御する
 */
export function useJudgeAvatarState({
  isJudging,
  isPostModalOpen,
  speakingJudge,
}: UseJudgeAvatarStateOptions): JudgeAvatarStateResult {
  const prefersReducedMotion = useReducedMotion()
  const [avatarStates, setAvatarStates] = useState<AvatarStateMap>(INITIAL_AVATAR_STATES)

  const blinkStartTimerRef = useRef<TimerMap>(createTimerMap())
  const blinkEndTimerRef = useRef<TimerMap>(createTimerMap())
  const mouthStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mouthEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const speakingJudgeRef = useRef<JudgePersona | null>(speakingJudge)

  const isAnimationEnabled = isJudging && !isPostModalOpen && !prefersReducedMotion

  useEffect(() => {
    speakingJudgeRef.current = speakingJudge
  }, [speakingJudge])

  useEffect(() => {
    if (!isAnimationEnabled) {
      clearJudgeTimerMap(blinkStartTimerRef.current)
      clearJudgeTimerMap(blinkEndTimerRef.current)
      setAvatarStates(INITIAL_AVATAR_STATES)
      return
    }

    const scheduleBlink = (judge: JudgePersona) => {
      const nextInterval = getRandomInterval(
        AVATAR_ANIMATION.BLINK_INTERVAL_MIN_MS,
        AVATAR_ANIMATION.BLINK_INTERVAL_MAX_MS
      )
      blinkStartTimerRef.current[judge] = setTimeout(() => {
        setAvatarStates((previous) => ({
          ...previous,
          [judge]: speakingJudgeRef.current === judge ? 'mouth_open' : 'eye_closed',
        }))

        blinkEndTimerRef.current[judge] = setTimeout(() => {
          setAvatarStates((previous) => ({
            ...previous,
            [judge]: speakingJudgeRef.current === judge ? 'mouth_open' : 'base',
          }))
          scheduleBlink(judge)
        }, AVATAR_ANIMATION.BLINK_DURATION_MS)
      }, nextInterval)
    }

    JUDGE.PERSONAS.forEach((judge) => {
      blinkStartTimerRef.current[judge] = clearTimer(blinkStartTimerRef.current[judge])
      blinkEndTimerRef.current[judge] = clearTimer(blinkEndTimerRef.current[judge])
      scheduleBlink(judge)
    })

    return () => {
      clearJudgeTimerMap(blinkStartTimerRef.current)
      clearJudgeTimerMap(blinkEndTimerRef.current)
    }
  }, [isAnimationEnabled])

  useEffect(() => {
    mouthStartTimerRef.current = clearTimer(mouthStartTimerRef.current)
    mouthEndTimerRef.current = clearTimer(mouthEndTimerRef.current)

    setAvatarStates((previous) => {
      const next = { ...previous }
      JUDGE.PERSONAS.forEach((judge) => {
        if (judge !== speakingJudge && next[judge] === 'mouth_open') {
          next[judge] = 'base'
        }
      })
      return next
    })

    if (!isAnimationEnabled || !speakingJudge) {
      return
    }

    setAvatarStates((previous) => ({
      ...previous,
      [speakingJudge]: 'mouth_open',
    }))

    const scheduleMouth = () => {
      const nextInterval = getRandomInterval(
        AVATAR_ANIMATION.MOUTH_INTERVAL_MIN_MS,
        AVATAR_ANIMATION.MOUTH_INTERVAL_MAX_MS
      )

      mouthStartTimerRef.current = setTimeout(() => {
        setAvatarStates((previous) => ({
          ...previous,
          [speakingJudge]: 'mouth_open',
        }))

        mouthEndTimerRef.current = setTimeout(() => {
          setAvatarStates((previous) => ({
            ...previous,
            [speakingJudge]: 'base',
          }))
          scheduleMouth()
        }, AVATAR_ANIMATION.MOUTH_DURATION_MS)
      }, nextInterval)
    }

    mouthEndTimerRef.current = setTimeout(() => {
      setAvatarStates((previous) => ({
        ...previous,
        [speakingJudge]: 'base',
      }))
      scheduleMouth()
    }, AVATAR_ANIMATION.MOUTH_DURATION_MS)

    return () => {
      mouthStartTimerRef.current = clearTimer(mouthStartTimerRef.current)
      mouthEndTimerRef.current = clearTimer(mouthEndTimerRef.current)
    }
  }, [isAnimationEnabled, speakingJudge])

  return { avatarStates }
}
