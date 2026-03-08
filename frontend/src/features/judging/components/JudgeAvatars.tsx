import { HIROYUKI_CATCHPHRASE } from '../../../shared/constants/avatar'
import { useJudgeAvatarState } from '../../../shared/hooks/useJudgeAvatarState'
import { useJudgeEntrance } from '../../../shared/hooks/useJudgeEntrance'
import { useJudgeSpeech } from '../../../shared/hooks/useJudgeSpeech'
import type { JudgePersona, Judgment } from '../../../shared/types/domain'
import type { JudgeDeskJudgment, JudgeDeskPhase } from './JudgeDesk'
import { JudgeSlot } from './JudgeSlot'

interface JudgeAvatarsProps {
  isJudging: boolean
  isPostModalOpen: boolean
  judgments?: Array<Partial<Judgment> & JudgeDeskJudgment>
  judgingPhase?: JudgeDeskPhase
  compactBottomSpacing?: boolean
  compactAvatarSize?: boolean
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
 * 審査員アバターとスコアパネルをGrid配置で表示するコンポーネント
 *
 * 各審査員スロット（吹き出し+アバター+パネル）を1カラム単位でカプセル化し、
 * 3カラムGridで横並びに配置することで、アバターとパネルの位置関係を強固にしている。
 */
export function JudgeAvatars({
  isJudging,
  isPostModalOpen,
  judgments,
  judgingPhase,
  compactBottomSpacing = false,
  compactAvatarSize = false,
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

  // 判定結果をMapに変換してルックアップを効率化
  const judgmentMap = new Map<JudgePersona, JudgeDeskJudgment>()
  if (judgments) {
    for (const judgment of judgments) {
      const key = judgment.judge ?? judgment.persona
      if (key) {
        judgmentMap.set(key, judgment)
      }
    }
  }

  const phase = judgingPhase ?? (isJudging ? 'speaking' : 'complete')
  const showSpeech = phase !== 'scoring' && phase !== 'complete'

  return (
    <div
      data-testid="judge-stage"
      className={`relative mx-auto w-full max-w-6xl ${
        compactBottomSpacing ? 'pb-8' : 'pb-16'
      }`}
    >
      <div
        data-testid="judge-avatars-container"
        className={`grid grid-cols-3 ${
          compactAvatarSize ? 'gap-2 sm:gap-4 md:gap-6 lg:gap-8' : 'gap-4 md:gap-6 lg:gap-8'
        }`}
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
            <JudgeSlot
              key={judge.id}
              judge={judge.id}
              alt={judge.alt}
              speechText={speechText}
              avatarState={avatarStates[judge.id]}
              entranceVariant={entrance}
              judgment={judgmentMap.get(judge.id)}
              phase={phase}
              showSpeech={showSpeech}
              compact={compactAvatarSize}
            />
          )
        })}
      </div>
    </div>
  )
}
