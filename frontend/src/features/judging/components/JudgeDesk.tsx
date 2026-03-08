import { useEffect, useState } from 'react'
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion'
import { useScoreRoulette } from '../../../shared/hooks/useScoreRoulette'
import type { JudgePersona } from '../../../shared/types/domain'

export type JudgeDeskPhase = 'entrance' | 'speaking' | 'scoring' | 'complete'

export type JudgeDeskJudgment = {
  judge?: JudgePersona
  persona?: JudgePersona
  score?: number
  total_score?: number
  success?: boolean
}

type JudgeDeskProps = {
  judgments?: JudgeDeskJudgment[]
  phase: JudgeDeskPhase
}

const JUDGE_DISPLAY_ORDER: readonly JudgePersona[] = ['nakao', 'hiroyuki', 'dewi']
const SCORE_PLACEHOLDER = '00'
const SCORE_NOT_AVAILABLE = 'N/A'
const LIT_ON = 'true'
const LIT_OFF = 'false'
const SCORE_LIGHT_INTERVAL_MS = 300
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

function buildJudgmentMap(judgments: JudgeDeskJudgment[]): Map<JudgePersona, JudgeDeskJudgment> {
  return judgments.reduce<Map<JudgePersona, JudgeDeskJudgment>>((map, judgment) => {
    const key = judgment.judge ?? judgment.persona
    if (key) map.set(key, judgment)
    return map
  }, new Map<JudgePersona, JudgeDeskJudgment>())
}

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

const JUDGE_LABELS: Record<JudgePersona, string> = {
  hiroyuki: 'ひろゆき',
  dewi: 'デヴィ婦人',
  nakao: '中尾彬',
}

interface JudgeDeskScorePanelProps {
  judge: JudgePersona
  judgment?: JudgeDeskJudgment
  phase: JudgeDeskPhase
  litValue: string
  prefersReducedMotion: boolean
}

function JudgeDeskScorePanel({
  judge,
  judgment,
  phase,
  litValue,
  prefersReducedMotion,
}: JudgeDeskScorePanelProps) {
  const scoreState = resolveScoreState(judgment)
  const { displayValue, isRouletting, isRevealed } = useScoreRoulette({
    phase,
    finalScoreLabel: scoreState.finalScoreLabel,
    isFailed: scoreState.isFailed,
    prefersReducedMotion,
    placeholder: SCORE_PLACEHOLDER,
  })
  const scoreLabel = scoreState.isFailed ? SCORE_NOT_AVAILABLE : displayValue
  const scoreAriaLabel = buildScoreStateAriaLabel({
    judge,
    isFailed: scoreState.isFailed,
    isRouletting,
    finalScoreLabel: scoreState.finalScoreLabel,
  })
  const scoreMotionClass = isRouletting ? 'score-rouletting' : isRevealed ? 'score-revealed' : ''
  const particleClass = isRevealed ? 'score-particles-active' : ''

  return (
    <div
      data-testid="judge-desk-score"
      data-lit={litValue}
      className={`judge-desk-panel glass-panel gold-border relative ${scoreMotionClass} ${particleClass}`}
      role="group"
      aria-label={scoreAriaLabel}
    >
      <span className="score-display-plate">
        <span className="digital-score gold-text">{scoreLabel}</span>
      </span>
      <span className="score-particles" aria-hidden="true">
        {SCORE_PARTICLES.map((particle, index) => (
          <span
            key={`${judge}-desk-particle-${index}`}
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
  )
}

export function JudgeDesk({ judgments, phase }: JudgeDeskProps) {
  const prefersReducedMotion = useReducedMotion()
  const [litCount, setLitCount] = useState(phase === 'scoring' ? 1 : 0)
  const byJudge = buildJudgmentMap(judgments ?? [])

  useEffect(() => {
    if (phase !== 'scoring') {
      setLitCount(0)
      return
    }

    if (prefersReducedMotion) {
      setLitCount(JUDGE_DISPLAY_ORDER.length)
      return
    }

    setLitCount(1)
    const secondTimer = setTimeout(() => setLitCount(2), SCORE_LIGHT_INTERVAL_MS)
    const thirdTimer = setTimeout(() => setLitCount(3), SCORE_LIGHT_INTERVAL_MS * 2)

    return () => {
      clearTimeout(secondTimer)
      clearTimeout(thirdTimer)
    }
  }, [phase, prefersReducedMotion])

  return (
    <div data-testid="judge-desk" className="judge-desk-shell">
      {/* 仕様上の表示順は左→中央→右（中尾→ひろゆき→デヴィ）で固定する */}
      {JUDGE_DISPLAY_ORDER.map((judge, index) => {
        const litValue = phase === 'scoring' && index < litCount ? LIT_ON : LIT_OFF

        return (
          <JudgeDeskScorePanel
            key={judge}
            judge={judge}
            judgment={byJudge.get(judge)}
            phase={phase}
            litValue={litValue}
            prefersReducedMotion={prefersReducedMotion}
          />
        )
      })}
    </div>
  )
}
