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

export function JudgeDesk({ judgments, phase }: JudgeDeskProps) {
  const byJudge = buildJudgmentMap(judgments ?? [])
  const litValue = phase === 'scoring' ? LIT_ON : LIT_OFF

  return (
    <div data-testid="judge-desk">
      {/* 仕様上の表示順は左→中央→右（中尾→ひろゆき→デヴィ）で固定する */}
      {JUDGE_DISPLAY_ORDER.map((judge) => (
        <div key={judge} data-testid="judge-desk-score" data-lit={litValue}>
          {resolveScoreLabel(byJudge.get(judge))}
        </div>
      ))}
    </div>
  )
}
