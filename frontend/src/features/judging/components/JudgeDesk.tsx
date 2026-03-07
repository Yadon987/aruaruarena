import { useEffect, useState } from 'react'
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion'
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
const SCORE_PLACEHOLDER = '---'
const SCORE_NOT_AVAILABLE = 'N/A'
const LIT_ON = 'true'
const LIT_OFF = 'false'
const SCORE_LIGHT_INTERVAL_MS = 300

function resolveScoreLabel(judgment?: JudgeDeskJudgment): string {
  if (!judgment) return SCORE_PLACEHOLDER
  if (judgment.success === false) return SCORE_NOT_AVAILABLE

  const score = judgment.score ?? judgment.total_score
  return typeof score === 'number' ? String(score) : SCORE_PLACEHOLDER
}

function buildJudgmentMap(judgments: JudgeDeskJudgment[]): Map<JudgePersona, JudgeDeskJudgment> {
  return judgments.reduce<Map<JudgePersona, JudgeDeskJudgment>>((map, judgment) => {
    const key = judgment.judge ?? judgment.persona
    if (key) map.set(key, judgment)
    return map
  }, new Map<JudgePersona, JudgeDeskJudgment>())
}

const JUDGE_LABELS: Record<JudgePersona, string> = {
  hiroyuki: 'ひろゆき',
  dewi: 'デヴィ婦人',
  nakao: '中尾彬',
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
    <div data-testid="judge-desk" className="glass-panel judge-desk-shell">
      {/* 仕様上の表示順は左→中央→右（中尾→ひろゆき→デヴィ）で固定する */}
      {JUDGE_DISPLAY_ORDER.map((judge, index) => {
        const litValue = phase === 'scoring' && index < litCount ? LIT_ON : LIT_OFF

        return (
          <div
            key={judge}
            data-testid="judge-desk-score"
            data-lit={litValue}
            className="judge-desk-panel"
            aria-label={`${JUDGE_LABELS[judge]}審査員のスコア: ${resolveScoreLabel(byJudge.get(judge))}`}
          >
            <span className="digital-score">{resolveScoreLabel(byJudge.get(judge))}</span>
          </div>
        )
      })}
    </div>
  )
}
