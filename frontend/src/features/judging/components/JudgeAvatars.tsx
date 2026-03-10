import { useJudgeAvatarState } from '../../../shared/hooks/useJudgeAvatarState'
import { useJudgeEntrance } from '../../../shared/hooks/useJudgeEntrance'
import { useJudgeSpeech } from '../../../shared/hooks/useJudgeSpeech'
import type { JudgePersona, Judgment } from '../../../shared/types/domain'
import { useJudgeResultSpeech } from '../hooks/useJudgeResultSpeech'
import type { JudgeDeskJudgment, JudgeDeskPhase } from './JudgeDesk'
import { JudgeSlot } from './JudgeSlot'

interface JudgeAvatarsProps {
  isJudging: boolean
  isPostModalOpen: boolean
  enableIdleBehavior?: boolean
  judgments?: Array<Partial<Judgment> & JudgeDeskJudgment>
  judgingPhase?: JudgeDeskPhase
  compactBottomSpacing?: boolean
  resultMode?: boolean
  resultJudgments?: Judgment[]
}

/** 審査員設定（表示順: 中尾 -> ひろゆき -> デヴィ） */
const JUDGE_CONFIG: readonly { id: JudgePersona; alt: string }[] = [
  { id: 'nakao', alt: '中尾彬風審査員' },
  { id: 'hiroyuki', alt: 'ひろゆき風審査員' },
  { id: 'dewi', alt: 'デヴィ夫人風審査員' },
] as const

/** フォールバックスピーチ（currentSpeechがnull時の表示） */
const FALLBACK_SPEECH = '...'
const STAGE_BASE_CLASS = 'relative mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-[96rem]'
const STAGE_COMPACT_BOTTOM_CLASS = 'pb-8'
const STAGE_DEFAULT_BOTTOM_CLASS = 'pb-16'
const AVATAR_GRID_CLASS =
  'grid grid-cols-3 gap-0 px-1.5 max-[360px]:px-1 sm:gap-2 sm:px-4 md:gap-6 md:px-0 lg:gap-8 xl:gap-10 2xl:gap-12'

interface ResolveSpeechTextOptions {
  judgeId: JudgePersona
  speakingJudge: JudgePersona | null
  currentSpeech: string | null
  isJudging: boolean
  isPostModalOpen: boolean
  enableIdleBehavior: boolean
}

function resolveSpeechText({
  judgeId,
  speakingJudge,
  currentSpeech,
  isJudging,
  isPostModalOpen,
  enableIdleBehavior,
}: ResolveSpeechTextOptions): string | null {
  const canSpeak = isJudging || enableIdleBehavior
  if (!canSpeak || isPostModalOpen) {
    return null
  }

  if (speakingJudge === judgeId) {
    return currentSpeech ?? FALLBACK_SPEECH
  }

  return null
}

function buildJudgmentMap(
  judgments?: Array<Partial<Judgment> & JudgeDeskJudgment>
): Map<JudgePersona, JudgeDeskJudgment> {
  if (!judgments) return new Map<JudgePersona, JudgeDeskJudgment>()

  return judgments.reduce<Map<JudgePersona, JudgeDeskJudgment>>((map, judgment) => {
    const key = judgment.judge ?? judgment.persona
    if (key) map.set(key, judgment)
    return map
  }, new Map<JudgePersona, JudgeDeskJudgment>())
}

function resolvePhase(isJudging: boolean, judgingPhase?: JudgeDeskPhase): JudgeDeskPhase {
  // フェーズ未指定時は画面状態に合わせて既定値を補完する
  return judgingPhase ?? (isJudging ? 'speaking' : 'complete')
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
  enableIdleBehavior = false,
  judgments,
  judgingPhase,
  compactBottomSpacing = false,
  resultMode = false,
  resultJudgments,
}: JudgeAvatarsProps) {
  const { hasEntered, variants: entranceVariants } = useJudgeEntrance()
  const { displayedComments } = useJudgeResultSpeech({
    judgments: resultJudgments,
    isActive: resultMode,
  })
  const isJudgingActive = isJudging && !resultMode
  const allowIdleSpeech = enableIdleBehavior && !resultMode
  const { currentSpeech, speakingJudge } = useJudgeSpeech({
    isJudging: isJudgingActive,
    isPostModalOpen,
    allowIdleSpeech,
  })
  const resultSpeakingJudge = resultMode ? null : speakingJudge
  const { avatarStates } = useJudgeAvatarState({
    isJudging: isJudgingActive,
    isPostModalOpen,
    speakingJudge: resultSpeakingJudge,
    allowIdleAnimation: allowIdleSpeech,
  })

  const judgmentMap = buildJudgmentMap(resultMode ? resultJudgments : judgments)
  const phase = resultMode ? 'complete' : resolvePhase(isJudgingActive, judgingPhase)
  const showSpeech = resultMode ? true : phase !== 'complete' || allowIdleSpeech
  const effectiveHasEntered = resultMode ? true : hasEntered

  return (
    <div
      data-testid="judge-stage"
      className={`${STAGE_BASE_CLASS} ${
        compactBottomSpacing ? STAGE_COMPACT_BOTTOM_CLASS : STAGE_DEFAULT_BOTTOM_CLASS
      }`}
    >
      <div data-testid="judge-avatars-container" className={AVATAR_GRID_CLASS}>
        {JUDGE_CONFIG.map((judge) => {
          const entrance = entranceVariants[judge.id]
          const speechText = resultMode
            ? (displayedComments[judge.id] ?? null)
            : resolveSpeechText({
                judgeId: judge.id,
                speakingJudge,
                currentSpeech,
                isJudging: isJudgingActive,
                isPostModalOpen,
                enableIdleBehavior: allowIdleSpeech,
              })

          return (
            <JudgeSlot
              key={judge.id}
              judge={judge.id}
              alt={judge.alt}
              speechText={speechText}
              avatarState={avatarStates[judge.id]}
              entranceVariant={entrance}
              hasEntered={effectiveHasEntered}
              judgment={judgmentMap.get(judge.id)}
              phase={phase}
              showSpeech={showSpeech}
            />
          )
        })}
      </div>
    </div>
  )
}
