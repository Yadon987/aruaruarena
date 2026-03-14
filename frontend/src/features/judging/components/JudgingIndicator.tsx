import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion'

const PHRASES = [
  '投稿を受け付けました ✨',
  '審査員が評価中...',
  '共感度を測定中...',
  '最終判定を集計中 💡',
]

const PHRASE_DURATION_MS = 1980

export function JudgingIndicator() {
  const [phaseIndex, setPhaseIndex] = useState(0)
  const prefersReducedMotion = useReducedMotion()
  const animationProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 15 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -15 },
      }

  useEffect(() => {
    const timer = setInterval(() => {
      setPhaseIndex((prev) => {
        if (prev >= PHRASES.length - 1) {
          clearInterval(timer)
          return prev
        }

        return prev + 1
      })
    }, PHRASE_DURATION_MS)

    return () => clearInterval(timer)
  }, [])

  return (
    <div
      data-testid="judging-screen"
      role="status"
      aria-label="審査中"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-20 z-40 flex items-center justify-center px-4 sm:top-24"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={phaseIndex}
          {...animationProps}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
          className="glass-panel min-w-[240px] max-w-sm rounded-[2rem] border border-amber-200/55 bg-gradient-to-r from-slate-950/42 via-amber-950/24 to-slate-950/42 px-6 py-3 text-center shadow-[0_0_24px_rgba(251,191,36,0.18)]"
        >
          <p className="gold-text inline-flex rounded-full bg-slate-950/35 px-4 py-1 text-base font-black tracking-[0.18em] text-amber-50 [text-shadow:0_1px_0_rgba(120,72,0,0.95),0_0_10px_rgba(255,217,120,0.55),0_0_22px_rgba(255,169,67,0.35)] sm:text-lg">
            {PHRASES[phaseIndex]}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
