import { motion } from 'framer-motion'
import {
  getAvatarImagePath,
  getJudgeAriaLabel,
  HIROYUKI_CATCHPHRASE,
} from '../../../shared/constants/avatar'
import { useJudgeAvatarState } from '../../../shared/hooks/useJudgeAvatarState'
import { useJudgeEntrance } from '../../../shared/hooks/useJudgeEntrance'
import { useJudgeSpeech } from '../../../shared/hooks/useJudgeSpeech'
import type { JudgePersona, Judgment } from '../../../shared/types/domain'
import { JudgeDesk } from './JudgeDesk'
import { JudgeSpeechBubble } from './JudgeSpeechBubble'

interface JudgeAvatarsProps {
  isJudging: boolean
  isPostModalOpen: boolean
  judgments?: Array<
    Partial<Judgment> & {
      judge?: JudgePersona
      score?: number
    }
  >
  judgingPhase?: 'entrance' | 'speaking' | 'scoring' | 'complete'
}

/** 審査員設定（表示順: 中尾 -> ひろゆき -> デヴィ） */
const JUDGE_CONFIG: readonly { id: JudgePersona; alt: string }[] = [
  { id: 'nakao', alt: '中尾彬風審査員' },
  { id: 'hiroyuki', alt: 'ひろゆき風審査員' },
  { id: 'dewi', alt: 'デヴィ夫人風審査員' },
] as const

/** フォールバックスピーチ（currentSpeechがnull時の表示） */
const FALLBACK_SPEECH = '...'

interface ResolveSpeechTextOptions {
  judgeId: JudgePersona
  speakingJudge: JudgePersona | null
  currentSpeech: string | null
  isJudging: boolean
  isPostModalOpen: boolean
}

function resolveSpeechText({
  judgeId,
  speakingJudge,
  currentSpeech,
  isJudging,
  isPostModalOpen,
}: ResolveSpeechTextOptions): string | null {
  if (!isJudging || isPostModalOpen) {
    return null
  }

  if (speakingJudge === judgeId) {
    return currentSpeech ?? FALLBACK_SPEECH
  }

  const shouldShowDefaultCatchphrase = judgeId === 'hiroyuki' && speakingJudge === null

  return shouldShowDefaultCatchphrase ? HIROYUKI_CATCHPHRASE : null
}

/**
 * 審査員アバターを横並びで表示するコンポーネント
 */
export function JudgeAvatars({
  isJudging,
  isPostModalOpen,
  judgments,
  judgingPhase,
}: JudgeAvatarsProps) {
  const { variants: entranceVariants } = useJudgeEntrance()
  const { currentSpeech, speakingJudge } = useJudgeSpeech({
    isJudging,
    isPostModalOpen,
  })
  const { avatarStates } = useJudgeAvatarState({
    isJudging,
    isPostModalOpen,
    speakingJudge,
  })

  return (
    <>
      {judgingPhase === 'scoring' && <JudgeDesk judgments={judgments ?? []} phase={judgingPhase} />}
      <ul
        data-testid="judge-avatars-container"
        className="flex flex-row items-end justify-center gap-4"
      >
        {JUDGE_CONFIG.map((judge) => {
          const entrance = entranceVariants[judge.id]
          const speechText = resolveSpeechText({
            judgeId: judge.id,
            speakingJudge,
            currentSpeech,
            isJudging,
            isPostModalOpen,
          })
          return (
            <li key={judge.id} className="relative flex flex-col items-center list-none">
              {speechText && (
                <JudgeSpeechBubble
                  isVisible={true}
                  text={speechText}
                  judgeType={judge.id}
                  testId={`catchphrase-${judge.id}`}
                />
              )}

              <motion.img
                src={getAvatarImagePath(judge.id, avatarStates[judge.id])}
                alt={judge.alt}
                aria-label={getJudgeAriaLabel(judge.id)}
                className="w-20 md:w-32 h-auto"
                initial={entrance.initial}
                animate={entrance.animate}
                transition={entrance.transition}
                draggable={false}
              />
            </li>
          )
        })}
      </ul>
    </>
  )
}
