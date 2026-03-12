import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import type { ComponentProps, CSSProperties } from 'react'
import { JUDGE_ENTRANCE } from '../../../shared/constants/animations'
import type { AvatarState } from '../../../shared/constants/avatar'
import { getAvatarImagePath } from '../../../shared/constants/avatar'
import { SCORE_THRESHOLDS } from '../../../shared/constants/validation'
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion'
import { useScoreRoulette } from '../../../shared/hooks/useScoreRoulette'
import type { JudgePersona } from '../../../shared/types/domain'
import type { JudgeDeskJudgment, JudgeDeskPhase } from './JudgeDesk'
import type { JudgeSeatBackrestVariant } from './JudgeSeatBackrest'
import { JudgeSeatBackrest } from './JudgeSeatBackrest'
import { JudgeSpeechBubble } from './JudgeSpeechBubble'

/** 審査員の表示名 */
const JUDGE_LABELS: Record<JudgePersona, string> = {
  hiroyuki: 'ひろゆき',
  dewi: 'デヴィ婦人',
  nakao: '中尾彬',
}

/** 審査員席の名札文言 */
const JUDGE_NAMEPLATES: Record<JudgePersona, string> = {
  nakao: '大物俳優N',
  hiroyuki: '論破王H',
  dewi: '富豪D夫人',
}

const SCORE_PLACEHOLDER = '00'
const SCORE_NOT_AVAILABLE = 'N/A'
const AVATAR_BREATHING_CLASS = 'judge-avatar-speaking-breath'
const ACTIVE_BACKREST_VARIANT: JudgeSeatBackrestVariant = 'royal-crown'
const VIP_IDLE_CYCLE_MS = 5000
const VIP_FLASH_TOTAL_MS = 1200
const DEWI_SPARKLE_DURATION_MS = 5200
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
const DEWI_SPARKLE_PARTICLES = [
  { left: 8, top: 18, dx: -12, dy: -24, delay: 0.0, hue: 'gold' },
  { left: 18, top: 10, dx: 8, dy: -28, delay: 0.16, hue: 'violet' },
  { left: 32, top: 22, dx: -6, dy: -26, delay: 0.28, hue: 'cyan' },
  { left: 44, top: 12, dx: 12, dy: -22, delay: 0.4, hue: 'pink' },
  { left: 72, top: 10, dx: 8, dy: -30, delay: 0.64, hue: 'violet' },
  { left: 86, top: 24, dx: -7, dy: -25, delay: 0.76, hue: 'cyan' },
  { left: 20, top: 42, dx: -9, dy: -18, delay: 0.88, hue: 'pink' },
  { left: 55, top: 44, dx: -8, dy: -19, delay: 1.12, hue: 'violet' },
  { left: 84, top: 48, dx: -6, dy: -16, delay: 1.24, hue: 'pink' },
] as const
const SCORE_PARTICLES = [
  { x: -34, y: -24 },
  { x: -18, y: -30 },
  { x: 10, y: -32 },
  { x: 30, y: -24 },
  { x: 34, y: 8 },
  { x: 20, y: 22 },
  { x: -12, y: 28 },
  { x: -30, y: 14 },
] as const
const VIP_BULB_STEP_MS = Math.round(JUDGE_ENTRANCE.DURATION_MS / Math.max(VIP_BULBS.length - 1, 1))

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
  /** 登場完了フラグ */
  hasEntered: boolean
  /** 審査結果 */
  judgment?: JudgeDeskJudgment
  /** 審査フェーズ */
  phase: JudgeDeskPhase
  /** スピーチを表示するか */
  showSpeech: boolean
  /** 低得点表示を有効化する */
  isLowScore?: boolean
  /** 審査結果モード */
  resultMode?: boolean
}

/**
 * スコア状態を解決する
 */
function resolveScoreState(judgment?: JudgeDeskJudgment): {
  finalScoreLabel: string | null
  isFailed: boolean
} {
  if (!judgment) {
    return { finalScoreLabel: null, isFailed: false }
  }
  if (judgment.success === false) {
    return { finalScoreLabel: null, isFailed: true }
  }
  const score = judgment.score ?? judgment.total_score
  return {
    finalScoreLabel: typeof score === 'number' ? String(score) : null,
    isFailed: false,
  }
}

/**
 * スコアのaria-labelを生成する
 */
function buildScoreAriaLabel(judge: JudgePersona, scoreLabel: string): string {
  return `${JUDGE_LABELS[judge]}審査員のスコア: ${scoreLabel}点`
}

function buildScoreStateAriaLabel({
  judge,
  isFailed,
  isRouletting,
  finalScoreLabel,
}: {
  judge: JudgePersona
  isFailed: boolean
  isRouletting: boolean
  finalScoreLabel: string | null
}): string {
  if (isFailed) {
    return `${JUDGE_LABELS[judge]}審査員のスコア: 判定対象外`
  }
  if (isRouletting) {
    return `${JUDGE_LABELS[judge]}審査員のスコアを集計中`
  }
  if (finalScoreLabel !== null) {
    return buildScoreAriaLabel(judge, finalScoreLabel)
  }
  return `${JUDGE_LABELS[judge]}審査員のスコアは未表示`
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
  hasEntered,
  judgment,
  phase,
  showSpeech,
  isLowScore = false,
  resultMode = false,
}: JudgeSlotProps) {
  const prefersReducedMotion = useReducedMotion()
  const scoreState = resolveScoreState(judgment)
  const { displayValue, isRouletting, isRevealed } = useScoreRoulette({
    phase,
    finalScoreLabel: scoreState.finalScoreLabel,
    isFailed: scoreState.isFailed,
    prefersReducedMotion,
    placeholder: SCORE_PLACEHOLDER,
  })
  const scoreLabel = scoreState.isFailed ? SCORE_NOT_AVAILABLE : displayValue
  const nameplateLabel = JUDGE_NAMEPLATES[judge]
  const scoreAriaLabel = buildScoreStateAriaLabel({
    judge,
    isFailed: scoreState.isFailed,
    isRouletting,
    finalScoreLabel: scoreState.finalScoreLabel,
  })
  const isScoring = phase === 'scoring'
  const isComplete = phase === 'complete'
  const isSpeaking = Boolean(speechText && showSpeech)
  const isSpeakingAnimated = isSpeaking && hasEntered && !resultMode
  const isLowScoreSlot =
    !scoreState.isFailed &&
    scoreState.finalScoreLabel !== null &&
    Number(scoreState.finalScoreLabel) <= SCORE_THRESHOLDS.LOW
  const shouldShowLowScore = isLowScore || isLowScoreSlot
  const [isFlashActive, setIsFlashActive] = useState(false)
  const [isDewiSparkleActive, setIsDewiSparkleActive] = useState(false)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dewiSparkleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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
  const scoreMotionClass = isRouletting
    ? 'score-rouletting'
    : isRevealed
      ? shouldShowLowScore
        ? 'score-revealed score-low-revealed'
        : 'score-revealed'
      : ''
  const particleClass = isRevealed ? 'score-particles-active' : ''
  const idleClassName = hasEntered && judge === 'hiroyuki' ? 'judge-avatar-hiroyuki-idle' : ''
  const dewiEffectsClassName = judge === 'dewi' ? 'judge-avatar-dewi-effects' : ''
  const sparkleClassName = isDewiSparkleActive ? 'judge-avatar-dewi-sparkle' : ''
  const avatarEffectClassName = [dewiEffectsClassName, idleClassName, sparkleClassName]
    .filter(Boolean)
    .join(' ')

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

  useEffect(() => {
    if (judge !== 'dewi') {
      if (dewiSparkleTimerRef.current) {
        clearTimeout(dewiSparkleTimerRef.current)
        dewiSparkleTimerRef.current = null
      }
      setIsDewiSparkleActive(false)
      return
    }
    if (prefersReducedMotion) {
      setIsDewiSparkleActive(false)
      return
    }

    setIsDewiSparkleActive(true)
    dewiSparkleTimerRef.current = setTimeout(() => {
      setIsDewiSparkleActive(false)
      dewiSparkleTimerRef.current = null
    }, DEWI_SPARKLE_DURATION_MS)

    return () => {
      if (dewiSparkleTimerRef.current) {
        clearTimeout(dewiSparkleTimerRef.current)
        dewiSparkleTimerRef.current = null
      }
    }
  }, [judge, prefersReducedMotion])

  return (
    <div
      data-testid={`judge-slot-${judge}`}
      className="relative flex w-full min-w-0 flex-col items-center gap-2 overflow-visible"
    >
      {/* 吹き出し */}
      {speechText && showSpeech && (
        <div
          className="absolute left-1/2 z-30 -translate-x-1/2"
          style={{
            top: 'calc(-1 * var(--judge-bubble-offset-y))',
            width: 'var(--judge-bubble-width)',
          }}
        >
          <JudgeSpeechBubble
            isVisible={true}
            text={speechText}
            judgeType={judge}
            testId={`catchphrase-${judge}`}
          />
        </div>
      )}

      {/* 背もたれ（アバター背面） */}
      <JudgeSeatBackrest variant={ACTIVE_BACKREST_VARIANT} />

      {/* アバター（Framer Motion が transform を上書きするため、位置調整は外側要素に適用する） */}
      <div
        className="relative z-10"
        style={{
          marginBottom: 'calc(-1 * var(--judge-avatar-margin-bottom))',
          transform: 'translateY(calc(-1 * var(--judge-stack-offset-y)))',
        }}
      >
        <div className={avatarEffectClassName}>
          {isDewiSparkleActive && (
            <span className="judge-avatar-dewi-sparkle-layer" aria-hidden="true">
              {DEWI_SPARKLE_PARTICLES.map((particle, index) => {
                const style: CSSProperties = {
                  left: `${particle.left}%`,
                  top: `${particle.top}%`,
                  ['--dewi-sparkle-dx' as string]: `${particle.dx}px`,
                  ['--dewi-sparkle-dy' as string]: `${particle.dy}px`,
                  ['--dewi-sparkle-delay' as string]: `${particle.delay}s`,
                }

                return (
                  <span
                    key={`dewi-sparkle-${index}`}
                    className={`dewi-sparkle-particle dewi-sparkle-${particle.hue}`}
                    style={style}
                  />
                )
              })}
            </span>
          )}
          <div className={isSpeakingAnimated ? AVATAR_BREATHING_CLASS : ''}>
            <motion.img
              src={getAvatarImagePath(judge, avatarState)}
              alt={alt}
              style={{ width: 'var(--judge-avatar-width)', height: 'auto' }}
              initial={hasEntered ? false : entranceVariant.initial}
              animate={entranceVariant.animate}
              transition={entranceVariant.transition}
              draggable={false}
            />
          </div>
        </div>
      </div>

      {/* スコアパネル */}
      <div
        data-testid="judge-desk-score"
        data-lit={isLit ? 'true' : 'false'}
        className={`judge-desk-panel judge-seat-panel vip-judge-desk ${deskStateClass} ${bulbStateClass} ${scoreMotionClass} ${particleClass} glass-panel relative z-20 w-full`}
        style={{
          maxWidth: 'var(--judge-score-width)',
          marginTop: 'calc(-1 * var(--judge-score-margin-top))',
        }}
        aria-label={scoreAriaLabel}
        role="group"
      >
        <span className="judge-seat-nameplate" data-testid={`judge-seat-nameplate-${judge}`}>
          {nameplateLabel}
        </span>
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
        <span className="score-display-plate">
          <span className="digital-score vip-score-text">{scoreLabel}</span>
        </span>
        <span className="score-particles" aria-hidden="true">
          {SCORE_PARTICLES.map((particle, index) => (
            <span
              key={`${judge}-particle-${index}`}
              className="score-particle"
              style={{
                ['--particle-index' as string]: String(index),
                ['--particle-x' as string]: `${particle.x}px`,
                ['--particle-y' as string]: `${particle.y}px`,
              }}
            />
          ))}
        </span>
      </div>
    </div>
  )
}
