import { useEffect, useMemo, useState } from 'react'
import { useReducedMotion } from './useReducedMotion'

interface UseTypewriterTextOptions {
  text: string
  isVisible: boolean
  baseIntervalMs: number
  maxDurationMs: number
}

/**
 * 吹き出しテキストをタイプライター表示する
 */
export function useTypewriterText({
  text,
  isVisible,
  baseIntervalMs,
  maxDurationMs,
}: UseTypewriterTextOptions): string {
  const prefersReducedMotion = useReducedMotion()
  const [displayText, setDisplayText] = useState(() => {
    if (!isVisible || !text) return ''
    return prefersReducedMotion ? text : text.slice(0, 1)
  })

  const effectiveIntervalMs = useMemo(() => {
    if (text.length <= 1) return baseIntervalMs
    const durationLimitedInterval = Math.max(1, Math.floor(maxDurationMs / text.length))
    return Math.min(baseIntervalMs, durationLimitedInterval)
  }, [baseIntervalMs, maxDurationMs, text.length])

  useEffect(() => {
    if (!isVisible) {
      setDisplayText('')
      return
    }

    if (!text) {
      setDisplayText('')
      return
    }

    if (prefersReducedMotion) {
      setDisplayText(text)
      return
    }

    let currentIndex = 1
    setDisplayText(text.slice(0, currentIndex))

    const timerId = setInterval(() => {
      currentIndex += 1

      if (currentIndex >= text.length) {
        setDisplayText(text)
        clearInterval(timerId)
        return
      }

      setDisplayText(text.slice(0, currentIndex))
    }, effectiveIntervalMs)

    return () => {
      clearInterval(timerId)
    }
  }, [effectiveIntervalMs, isVisible, prefersReducedMotion, text])

  return displayText
}
