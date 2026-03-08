import type { ComponentProps } from 'react'
import { motion } from 'framer-motion'
import { getAvatarImagePath, getJudgeAriaLabel } from '../../../shared/constants/avatar'
import type { AvatarState } from '../../../shared/constants/avatar'
import type { JudgePersona } from '../../../shared/types/domain'
import type { JudgeDeskJudgment, JudgeDeskPhase } from './JudgeDesk'
import { JudgeSpeechBubble } from './JudgeSpeechBubble'

/** 審査員ごとのネオンクラス設定 */
const JUDGE_NEON_CLASS: Record<JudgePersona, { border: string; text: string }> = {
  nakao: { border: 'neon-border-cyan', text: 'neon-text-cyan' },
  hiroyuki: { border: 'neon-border-pink', text: 'neon-text-pink' },
  dewi: { border: 'neon-border-cyan', text: 'neon-text-cyan' },
}

/** 審査員の表示名 */
const JUDGE_LABELS: Record<JudgePersona, string> = {
  hiroyuki: 'ひろゆき',
  dewi: 'デヴィ婦人',
  nakao: '中尾彬',
}

const SCORE_PLACEHOLDER = '---'
const SCORE_NOT_AVAILABLE = 'N/A'
const AVATAR_SIZE_CLASS = 'h-auto w-28 md:w-48 lg:w-56'

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
  const neonClass = JUDGE_NEON_CLASS[judge]
  const scoreLabel = resolveScoreLabel(judgment)
  const isLit = phase === 'scoring' || phase === 'complete'

  return (
    <div
      data-testid={`judge-slot-${judge}`}
      className="relative flex flex-col items-center gap-2 overflow-visible"
    >
      {/* 吹き出し */}
      {speechText && showSpeech && (
        <JudgeSpeechBubble
          isVisible={true}
          text={speechText}
          judgeType={judge}
          testId={`catchphrase-${judge}`}
        />
      )}

      {/* 背もたれ（アバター背面） */}
      <div className="judge-seat-back" aria-hidden="true" />

      {/* アバター（Framer Motion が transform を上書きするため、位置調整は外側要素に適用する） */}
      <div className="relative z-10 -mb-7 -translate-y-12 md:-mb-12 md:-translate-y-18 lg:-mb-14 lg:-translate-y-24">
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

      {/* スコアパネル */}
      <div
        data-testid="judge-desk-score"
        data-lit={isLit ? 'true' : 'false'}
        className={`judge-desk-panel judge-seat-panel glass-panel ${neonClass.border} relative z-20 -mt-8 w-[110%] max-w-[14rem] md:-mt-12 md:w-[120%] md:max-w-[20rem] lg:-mt-16 lg:max-w-[24rem]`}
        aria-label={buildScoreAriaLabel(judge, scoreLabel)}
        role="group"
      >
        <span className={`digital-score ${neonClass.text}`}>{scoreLabel}</span>
        <span className={`digital-score-unit ${neonClass.text}`}>点</span>
      </div>
    </div>
  )
}
