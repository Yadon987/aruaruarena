import type { JudgePersona } from '../../../shared/types/domain'

type JudgeDeskPhase = 'entrance' | 'speaking' | 'scoring' | 'complete'

type JudgeDeskJudgment = {
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

const ORDER: JudgePersona[] = ['nakao', 'hiroyuki', 'dewi']

function resolveScoreLabel(judgment?: JudgeDeskJudgment): string {
  if (!judgment) return '---'
  if (judgment.success === false) return 'N/A'

  const score = judgment.score ?? judgment.total_score
  return typeof score === 'number' ? String(score) : '---'
}

export function JudgeDesk({ judgments, phase }: JudgeDeskProps) {
  const byJudge = (judgments ?? []).reduce<Map<JudgePersona, JudgeDeskJudgment>>((map, judgment) => {
    const key = judgment.judge ?? judgment.persona
    if (key) map.set(key, judgment)
    return map
  }, new Map<JudgePersona, JudgeDeskJudgment>())

  return (
    <div data-testid="judge-desk">
      {ORDER.map((judge) => (
        <div key={judge} data-testid="judge-desk-score" data-lit={phase === 'scoring' ? 'true' : 'false'}>
          {resolveScoreLabel(byJudge.get(judge))}
        </div>
      ))}
    </div>
  )
}
