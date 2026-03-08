import { AnimatePresence, motion } from 'framer-motion'
import { JUDGE_SPEECH } from '../../../shared/constants/animations'
import { useTypewriterText } from '../../../shared/hooks/useTypewriterText'
import type { JudgePersona } from '../../../shared/types/domain'

interface JudgeSpeechBubbleProps {
  isVisible: boolean
  text: string
  judgeType: JudgePersona
  testId?: string
}

const BUBBLE_VARIANTS = JUDGE_SPEECH.BUBBLE_VARIANTS
const TYPEWRITER_INTERVAL_MS = 40
const TYPEWRITER_MARGIN_MS = 200

const POSITION_CLASSES: Record<JudgePersona, string> = {
  hiroyuki: 'justify-center',
  dewi: 'justify-center',
  nakao: 'justify-center',
}

/**
 * 審査員の吹き出しを表示するコンポーネント
 */
export function JudgeSpeechBubble({ isVisible, text, judgeType, testId }: JudgeSpeechBubbleProps) {
  const displayText = useTypewriterText({
    text,
    isVisible,
    baseIntervalMs: TYPEWRITER_INTERVAL_MS,
    maxDurationMs: Math.max(JUDGE_SPEECH.DURATION_MS - TYPEWRITER_MARGIN_MS, TYPEWRITER_INTERVAL_MS),
  })

  return (
    <AnimatePresence>
      {isVisible && (
        <div className={`relative z-30 mb-2 flex ${POSITION_CLASSES[judgeType]}`}>
          <span className="sr-only" role="status" aria-live="polite">
            {text}
          </span>
          <motion.div
            data-testid={testId}
            initial={BUBBLE_VARIANTS.initial}
            animate={BUBBLE_VARIANTS.animate}
            exit={BUBBLE_VARIANTS.exit}
            className="whitespace-normal rounded-lg bg-white/95 px-3 py-2 text-sm shadow-md"
          >
            {displayText}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
