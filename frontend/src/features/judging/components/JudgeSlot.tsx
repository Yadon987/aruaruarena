import { useEffect, useRef, useState } from 'react'
import type { ComponentProps, CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { getAvatarImagePath, getJudgeAriaLabel } from '../../../shared/constants/avatar'
import { JUDGE_ENTRANCE } from '../../../shared/constants/animations'
import type { AvatarState } from '../../../shared/constants/avatar'
import type { JudgePersona } from '../../../shared/types/domain'
import type { JudgeDeskJudgment, JudgeDeskPhase } from './JudgeDesk'
import { JudgeSpeechBubble } from './JudgeSpeechBubble'

/** 審査員の表示名 */
const JUDGE_LABELS: Record<JudgePersona, string> = {
  hiroyuki: 'ひろゆき',
  dewi: 'デヴィ婦人',
  nakao: '中尾彬',
}

const SCORE_PLACEHOLDER = '---'
const SCORE_NOT_AVAILABLE = 'N/A'
const AVATAR_SIZE_CLASS = 'h-auto w-28 md:w-48 lg:w-56'
const AVATAR_BREATHING_CLASS = 'judge-avatar-speaking-breath'
const VIP_IDLE_CYCLE_MS = 5000
const VIP_FLASH_TOTAL_MS = 1200
const VIP_BULBS = [
  { left: 8, top: 8 },
  { left: 25, top: 5 },
  { left: 50, top: 4 },
  { left: 75, top: 5 },
  { left: 92, top: 8 },
  { left: 95, top: 30 },
  { left: 95, top: 60 },
  { left: 92, top: 88 },
  { left: 75, top: 92 },
  { left: 50, top: 94 },
  { left: 25, top: 92 },
  { left: 8, top: 88 },
  { left: 5, top: 60 },
  { left: 5, top: 30 },
] as const
const VIP_BULB_STEP_MS = Math.round(
  JUDGE_ENTRANCE.DURATION_MS / Math.max(VIP_BULBS.length - 1, 1)
)

/** 登場アニメーションのバリアント型 */
type MotionImageProps = ComponentProps<typeof motion.img>
type EntranceVariant = {
  initial: MotionImageProps['initial']
  animate: MotionImageProps['animate']
  transition: MotionImageProps['transition']
}

interface JudgeSlotProps {
  /** 審査員ID */
  judge: JudgePersona
  /** 審査員の表示名（alt用） */
  alt: string
  /** スピーチテキスト（null時は非表示） */
  speechText: string | null
  /** アバターの状態 */
  avatarState: AvatarState
  /** 登場アニメーションのバリアント */
  entranceVariant: EntranceVariant
  /** 審査結果 */
  judgment?: JudgeDeskJudgment
  /** 審査フェーズ */
  phase: JudgeDeskPhase
  /** スピーチを表示するか */
  showSpeech: boolean
}

/**
 * スコアラベルを解決する
 */
function resolveScoreLabel(judgment?: JudgeDeskJudgment): string {
  if (!judgment) return SCORE_PLACEHOLDER
  if (judgment.success === false) return SCORE_NOT_AVAILABLE

  const score = judgment.score ?? judgment.total_score
  return typeof score === 'number' ? String(score) : SCORE_PLACEHOLDER
}

/**
 * スコアのaria-labelを生成する
 */
function buildScoreAriaLabel(judge: JudgePersona, scoreLabel: string): string {
  return `${JUDGE_LABELS[judge]}審査員のスコア: ${scoreLabel}点`
}

/**
 * 1審査員分のスロットコンポーネント
 * 吹き出し・アバター・スコアパネルを縦積みで配置し、位置関係を強固にする
 */
export function JudgeSlot({
  judge,
  alt,
  speechText,
  avatarState,
  entranceVariant,
  judgment,
  phase,
  showSpeech,
}: JudgeSlotProps) {
  const scoreLabel = resolveScoreLabel(judgment)
  const isScoring = phase === 'scoring'
  const isComplete = phase === 'complete'
  const isSpeaking = Boolean(speechText && showSpeech)
  const [isFlashActive, setIsFlashActive] = useState(false)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isLit = isScoring || isComplete
  const bulbStateClass = isFlashActive
    ? 'vip-bulbs-flash'
    : isScoring
      ? 'vip-bulbs-roulette'
      : 'vip-bulbs-idle'
  const deskStateClass = isComplete
    ? 'vip-desk-complete'
    : isScoring
      ? 'vip-desk-scoring'
      : 'vip-desk-idle'

  useEffect(() => {
    const clearFlashTimer = () => {
      if (flashTimerRef.current) {
        clearTimeout(flashTimerRef.current)
        flashTimerRef.current = null
      }
    }

    if (isComplete) {
      setIsFlashActive(true)
      flashTimerRef.current = setTimeout(() => {
        setIsFlashActive(false)
      }, VIP_FLASH_TOTAL_MS)
    } else {
      setIsFlashActive(false)
    }

    return clearFlashTimer
  }, [isComplete])

  return (
    <div
      data-testid={`judge-slot-${judge}`}
      className="relative flex w-full min-w-0 flex-col items-center gap-2 overflow-visible"
    >
      {/* 吹き出し */}
      {speechText && showSpeech && (
        <div className="absolute -top-24 left-1/2 z-30 w-40 -translate-x-1/2 sm:w-52 md:-top-28 md:w-60 lg:-top-32 lg:w-64">
          <JudgeSpeechBubble
            isVisible={true}
            text={speechText}
            judgeType={judge}
            testId={`catchphrase-${judge}`}
          />
        </div>
      )}

      {/* 背もたれ（アバター背面） */}
      <div className="judge-seat-back vip-judge-seat" aria-hidden="true" />

      {/* アバター（Framer Motion が transform を上書きするため、位置調整は外側要素に適用する） */}
      <div className="relative z-10 -mb-7 -translate-y-12 md:-mb-12 md:-translate-y-16 lg:-mb-14 lg:-translate-y-24">
        <div className={isSpeaking ? AVATAR_BREATHING_CLASS : ''}>
          <motion.img
            src={getAvatarImagePath(judge, avatarState)}
            alt={alt}
            aria-label={getJudgeAriaLabel(judge)}
            className={AVATAR_SIZE_CLASS}
            initial={entranceVariant.initial}
            animate={entranceVariant.animate}
            transition={entranceVariant.transition}
            draggable={false}
          />
        </div>
      </div>

      {/* スコアパネル */}
      <div
        data-testid="judge-desk-score"
        data-lit={isLit ? 'true' : 'false'}
        className={`judge-desk-panel judge-seat-panel vip-judge-desk ${deskStateClass} ${bulbStateClass} glass-panel relative z-20 -mt-8 w-full max-w-[14rem] md:-mt-12 md:max-w-[20rem] lg:-mt-16 lg:max-w-[24rem]`}
        aria-label={buildScoreAriaLabel(judge, scoreLabel)}
        role="group"
      >
        <div className="vip-bulb-track" aria-hidden="true">
          {VIP_BULBS.map((bulb, index) => {
            const style: CSSProperties = {
              left: `${bulb.left}%`,
              top: `${bulb.top}%`,
              ['--vip-bulb-delay' as string]: `${index * VIP_BULB_STEP_MS}ms`,
              ['--vip-idle-cycle' as string]: `${VIP_IDLE_CYCLE_MS}ms`,
            }
            return <span key={`${judge}-bulb-${index}`} className="vip-bulb" style={style} />
          })}
        </div>
        <span className="digital-score vip-score-text">{scoreLabel}</span>
        <span className="digital-score-unit vip-score-text">点</span>
      </div>
    </div>
  )
}
