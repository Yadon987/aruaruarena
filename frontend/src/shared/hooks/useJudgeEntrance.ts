import type { HTMLMotionProps } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { JUDGE_ENTRANCE, type JudgeEntranceVariants } from '../constants/animations'
import { useReducedMotion } from './useReducedMotion'

const ENTRANCE_DURATION_MS = JUDGE_ENTRANCE.DURATION_MS

type MotionImageProps = HTMLMotionProps<'img'>
type JudgeEntranceVariant = {
  initial: MotionImageProps['initial']
  animate: MotionImageProps['animate']
  transition: MotionImageProps['transition']
}
type MotionCompatibleEntranceVariants = Record<keyof JudgeEntranceVariants, JudgeEntranceVariant>

interface JudgeEntranceState {
  hasEntered: boolean
  variants: MotionCompatibleEntranceVariants
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

  const variants: MotionCompatibleEntranceVariants = JUDGE_ENTRANCE.VARIANTS
  return { hasEntered, variants }
}
