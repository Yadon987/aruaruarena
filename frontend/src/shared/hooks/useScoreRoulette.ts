import { useEffect, useRef, useState } from 'react'

type ScorePhase = 'entrance' | 'speaking' | 'scoring' | 'complete'

interface UseScoreRouletteOptions {
  phase: ScorePhase
  finalScoreLabel: string | null
  isFailed?: boolean
  prefersReducedMotion: boolean
  placeholder?: string
}

interface UseScoreRouletteResult {
  displayValue: string
  isRouletting: boolean
  isRevealed: boolean
}

const ROULETTE_INTERVAL_MS = 60
const REVEAL_DURATION_MS = 400
const DEFAULT_PLACEHOLDER = '00'
const SCORE_MIN = 1
const SCORE_MAX = 99
const SCORE_FAILED = 'N/A'

const getRandomScoreLabel = (): string => {
  const value = Math.floor(Math.random() * (SCORE_MAX - SCORE_MIN + 1)) + SCORE_MIN
  return String(value).padStart(2, '0')
}

/**
 * スコア表示のルーレット演出を制御する
 */
export function useScoreRoulette({
  phase,
  finalScoreLabel,
  isFailed = false,
  prefersReducedMotion,
  placeholder = DEFAULT_PLACEHOLDER,
}: UseScoreRouletteOptions): UseScoreRouletteResult {
  const [displayValue, setDisplayValue] = useState(() => {
    if (isFailed) return SCORE_FAILED
    if (phase === 'complete') return finalScoreLabel ?? placeholder
    if (phase === 'scoring' && prefersReducedMotion) return finalScoreLabel ?? placeholder
    return placeholder
  })
  const [isRevealed, setIsRevealed] = useState(false)
  const previousPhaseRef = useRef<ScorePhase>(phase)

  useEffect(() => {
    if (isFailed) {
      setDisplayValue(SCORE_FAILED)
      return
    }

    if (phase !== 'scoring') {
      return
    }

    if (prefersReducedMotion) {
      setDisplayValue(finalScoreLabel ?? placeholder)
      return
    }

    setDisplayValue(getRandomScoreLabel())
    const intervalId = setInterval(() => {
      setDisplayValue(getRandomScoreLabel())
    }, ROULETTE_INTERVAL_MS)

    return () => {
      clearInterval(intervalId)
    }
  }, [finalScoreLabel, isFailed, phase, placeholder, prefersReducedMotion])

  useEffect(() => {
    if (isFailed) {
      setIsRevealed(false)
      return
    }

    if (phase === 'complete') {
      setDisplayValue(finalScoreLabel ?? placeholder)
      const isNewlyCompleted = previousPhaseRef.current !== 'complete'
      if (isNewlyCompleted && !prefersReducedMotion) {
        setIsRevealed(true)
        const revealTimer = setTimeout(() => {
          setIsRevealed(false)
        }, REVEAL_DURATION_MS)
        previousPhaseRef.current = phase
        return () => clearTimeout(revealTimer)
      }
      setIsRevealed(false)
      previousPhaseRef.current = phase
      return
    }

    if (phase !== 'scoring') {
      setDisplayValue(placeholder)
    }

    setIsRevealed(false)
    previousPhaseRef.current = phase
  }, [finalScoreLabel, isFailed, phase, placeholder, prefersReducedMotion])

  return {
    displayValue,
    isRouletting: phase === 'scoring' && !prefersReducedMotion && !isFailed,
    isRevealed,
  }
}
