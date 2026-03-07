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
import type { JudgeDeskJudgment, JudgeDeskPhase } from './JudgeDesk'
import { JudgeSpeechBubble } from './JudgeSpeechBubble'

interface JudgeAvatarsProps {
  isJudging: boolean
  isPostModalOpen: boolean
  judgments?: Array<Partial<Judgment> & JudgeDeskJudgment>
  judgingPhase?: JudgeDeskPhase
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
    <div
      data-testid="judge-stage"
      className="relative mx-auto w-full max-w-6xl overflow-hidden pb-16"
    >
      <ul
        data-testid="judge-avatars-container"
        className="relative z-0 flex flex-row items-end justify-center gap-6 md:gap-8 lg:gap-10"
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
            <li key={judge.id} className="relative z-0 flex flex-col items-center list-none">
              {speechText && judgingPhase !== 'scoring' && (
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
                className="w-28 md:w-48 lg:w-56 h-auto"
                initial={entrance.initial}
                animate={entrance.animate}
                transition={entrance.transition}
                draggable={false}
              />
            </li>
          )
        })}
      </ul>
      {/* デスクは常時表示し、phaseに応じてスコア演出だけを切り替える */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-2">
        <JudgeDesk judgments={judgments ?? []} phase={judgingPhase ?? 'complete'} />
      </div>
    </div>
  )
}
