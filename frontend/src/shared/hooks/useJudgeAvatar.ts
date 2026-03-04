import { useEffect, useRef, useState } from 'react'
import { AVATAR_ANIMATION, getAvatarImagePath, type AvatarState } from '../constants/avatar.ts'
import type { JudgePersona } from '../types/domain.ts'

import { useReducedMotion } from './useReducedMotion.ts'

interface JudgeAvatarState {
  currentImage: string
  currentState: AvatarState
}

/**
 * 審査員アバターのアニメーションを制御する
 */
export function useJudgeAvatar(persona: JudgePersona, isSpeaking: boolean): JudgeAvatarState {
  const prefersReducedMotion = useReducedMotion()
  const [currentState, setCurrentState] = useState<AvatarState>('base')
  const blinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mouthStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mouthEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (prefersReducedMotion) return

    blinkTimerRef.current = setTimeout(() => {
      setCurrentState('eye_closed')
    }, AVATAR_ANIMATION.BLINK_INTERVAL_MIN_MS)

    return () => {
      if (blinkTimerRef.current) {
        clearTimeout(blinkTimerRef.current)
      }
    }
  }, [prefersReducedMotion])

  useEffect(() => {
    if (prefersReducedMotion || !isSpeaking) return

    mouthStartTimerRef.current = setTimeout(() => {
      setCurrentState((previousState) =>
        previousState === 'eye_closed' ? previousState : 'mouth_open'
      )
    }, AVATAR_ANIMATION.MOUTH_INTERVAL_MIN_MS)

    mouthEndTimerRef.current = setTimeout(() => {
      setCurrentState((previousState) => (previousState === 'mouth_open' ? 'base' : previousState))
    }, AVATAR_ANIMATION.MOUTH_INTERVAL_MIN_MS + AVATAR_ANIMATION.MOUTH_DURATION_MS)

    return () => {
      if (mouthStartTimerRef.current) {
        clearTimeout(mouthStartTimerRef.current)
      }

      if (mouthEndTimerRef.current) {
        clearTimeout(mouthEndTimerRef.current)
      }
    }
  }, [prefersReducedMotion, isSpeaking])

  return {
    currentImage: getAvatarImagePath(persona, currentState),
    currentState,
  }
}
