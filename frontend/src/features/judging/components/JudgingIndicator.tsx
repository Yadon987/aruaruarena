import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'

const PHRASES = [
  '投稿を受け付けました ✨',
  '審査員が評価中...',
  '共感度を測定中...',
  '最終判定を集計中 💡',
]

const PHRASE_DURATION_MS = 1980

interface JudgingIndicatorProps {}

export function JudgingIndicator({}: JudgingIndicatorProps = {}) {
  const [phaseIndex, setPhaseIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setPhaseIndex((prev) => (prev + 1) % PHRASES.length)
    }, PHRASE_DURATION_MS)

    return () => clearInterval(timer)
  }, [])

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-20 z-40 flex items-center justify-center px-4 sm:top-24"
      aria-hidden="true"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={phaseIndex}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
          className="glass-panel min-w-[240px] max-w-sm rounded-[2rem] border border-amber-200/40 bg-gradient-to-r from-amber-500/10 via-yellow-300/10 to-amber-500/10 px-6 py-3 text-center shadow-[0_0_24px_rgba(251,191,36,0.15)]"
        >
          <p className="gold-text text-base font-bold tracking-wider sm:text-lg">
            {PHRASES[phaseIndex]}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
