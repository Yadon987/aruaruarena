import { AnimatePresence, motion } from 'framer-motion'
import { JUDGE_SPEECH } from '../../../shared/constants/animations'
import type { JudgePersona } from '../../../shared/types/domain'

interface JudgeSpeechBubbleProps {
  isVisible: boolean
  text: string
  judgeType: JudgePersona
  testId?: string
}

const BUBBLE_VARIANTS = JUDGE_SPEECH.BUBBLE_VARIANTS

const POSITION_CLASSES: Record<JudgePersona, string> = {
  hiroyuki: 'justify-center',
  dewi: 'justify-center',
  nakao: 'justify-start',
}

/**
 * 審査員の吹き出しを表示するコンポーネント
 */
export function JudgeSpeechBubble({ isVisible, text, judgeType, testId }: JudgeSpeechBubbleProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <div className={`flex ${POSITION_CLASSES[judgeType]} mb-2`}>
          <motion.div
            role="status"
            aria-live="polite"
            data-testid={testId}
            initial={BUBBLE_VARIANTS.initial}
            animate={BUBBLE_VARIANTS.animate}
            exit={BUBBLE_VARIANTS.exit}
            className="whitespace-normal rounded-lg bg-white px-3 py-2 text-sm shadow-md"
          >
            {text}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
