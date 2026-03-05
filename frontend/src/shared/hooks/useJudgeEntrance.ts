import { useEffect, useRef, useState } from 'react'
import { JUDGE_ENTRANCE } from '../constants/animations'
import { useReducedMotion } from './useReducedMotion'

const ENTRANCE_DURATION_MS = JUDGE_ENTRANCE.DURATION_MS

type JudgeEntranceVariants = typeof JUDGE_ENTRANCE.VARIANTS

interface JudgeEntranceState {
  hasEntered: boolean
  variants: JudgeEntranceVariants
}

/**
 * 審査員登場アニメーションを制御するフック
 */
export function useJudgeEntrance(): JudgeEntranceState {
  const prefersReducedMotion = useReducedMotion()
  const [hasEntered, setHasEntered] = useState(prefersReducedMotion)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (prefersReducedMotion) {
      setHasEntered(true)
      return
    }

    setHasEntered(false)

    timerRef.current = setTimeout(() => {
      setHasEntered(true)
    }, ENTRANCE_DURATION_MS)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [prefersReducedMotion])

  const variants = JUDGE_ENTRANCE.VARIANTS
  return { hasEntered, variants }
}
