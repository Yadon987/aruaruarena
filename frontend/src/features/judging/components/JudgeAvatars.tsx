import { motion, type TargetAndTransition } from 'framer-motion'
import {
  getAvatarImagePath,
  getJudgeAriaLabel,
  HIROYUKI_CATCHPHRASE,
} from '../../../shared/constants/avatar'
import { useJudgeBreathing } from '../../../shared/hooks/useJudgeBreathing'
import { useJudgeEntrance } from '../../../shared/hooks/useJudgeEntrance'
import { useJudgeSpeech } from '../../../shared/hooks/useJudgeSpeech'
import type { JudgePersona } from '../../../shared/types/domain'
import { JudgeSpeechBubble } from './JudgeSpeechBubble'

interface JudgeAvatarsProps {
  isJudging: boolean
  isPostModalOpen: boolean
}

/** 審査員設定（表示順: 中尾 -> ひろゆき -> デヴィ） */
const JUDGE_CONFIG: readonly { id: JudgePersona; alt: string }[] = [
  { id: 'nakao', alt: '中尾彬風審査員' },
  { id: 'hiroyuki', alt: 'ひろゆき風審査員' },
  { id: 'dewi', alt: 'デヴィ夫人風審査員' },
] as const

/** フォールバックスピーチ（currentSpeechがnull時の表示） */
const FALLBACK_SPEECH = '...'

/**
 * 審査員アバターを横並びで表示するコンポーネント
 */
export function JudgeAvatars({ isJudging, isPostModalOpen }: JudgeAvatarsProps) {
  const { hasEntered, variants: entranceVariants } = useJudgeEntrance()
  const { isBreathing: isBreathingAllowed, variants: breathingVariants } = useJudgeBreathing({
    hasEntered,
    isSpeaking: false,
  })
  const { currentSpeech, speakingJudge } = useJudgeSpeech({
    isJudging,
    isPostModalOpen,
  })

  return (
    <ul
      data-testid="judge-avatars-container"
      className="flex flex-row items-end justify-center gap-4"
    >
      {JUDGE_CONFIG.map((judge) => {
        const isSpeaking = speakingJudge === judge.id
        const entrance = entranceVariants[judge.id]
        const breathing = breathingVariants[judge.id]
        const mutableBreathingKeyframes = {
          ...breathing.keyframes,
          scale: [...breathing.keyframes.scale],
          ...('y' in breathing.keyframes && Array.isArray(breathing.keyframes.y)
            ? { y: [...breathing.keyframes.y] }
            : {}),
        }
        const shouldShowDefaultCatchphrase =
          judge.id === 'hiroyuki' && isJudging && !isPostModalOpen && speakingJudge === null
        const speechText = isSpeaking
          ? (currentSpeech ?? FALLBACK_SPEECH)
          : shouldShowDefaultCatchphrase
            ? HIROYUKI_CATCHPHRASE
            : null
        const shouldShowSpeechBubble = Boolean(speechText)

        return (
          <li key={judge.id} className="relative flex flex-col items-center list-none">
            {shouldShowSpeechBubble && speechText && (
              <JudgeSpeechBubble
                isVisible={true}
                text={speechText}
                judgeType={judge.id as JudgePersona}
                testId={`catchphrase-${judge.id}`}
              />
            )}

            <motion.img
              src={getAvatarImagePath(judge.id, 'base')}
              alt={judge.alt}
              aria-label={getJudgeAriaLabel(judge.id)}
              className="w-20 md:w-32 h-auto"
              initial={entrance.initial}
              animate={
                hasEntered
                  ? isBreathingAllowed && !isSpeaking
                    ? (mutableBreathingKeyframes as TargetAndTransition)
                    : entrance.animate
                  : entrance.animate
              }
              transition={
                hasEntered
                  ? isBreathingAllowed && !isSpeaking
                    ? breathing.transition
                    : entrance.transition
                  : entrance.transition
              }
              draggable={false}
            />
          </li>
        )
      })}
    </ul>
  )
}
