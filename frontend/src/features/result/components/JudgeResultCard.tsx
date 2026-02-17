import type { Judgment } from '../../../shared/types/domain'

type Props = {
  judgment: Judgment
}

const PERSONA_LABELS: Record<Judgment['persona'], string> = {
  hiroyuki: 'ひろゆき風',
  dewi: 'デヴィ婦人風',
  nakao: '中尾彬風',
}

export function JudgeResultCard({ judgment }: Props) {
  return (
    <article data-testid="judge-result-card" className="rounded border p-3">
      <h3 className="font-semibold">{PERSONA_LABELS[judgment.persona]}</h3>
      <ul className="mt-2 text-sm">
        <li>共感度: {judgment.empathy}</li>
        <li>面白さ: {judgment.humor}</li>
        <li>簡潔さ: {judgment.brevity}</li>
        <li>独創性: {judgment.originality}</li>
        <li>表現力: {judgment.expression}</li>
        <li>合計点: {judgment.total_score}</li>
      </ul>
      <p className="mt-2">{judgment.comment}</p>
      <p className="mt-1 text-sm">{judgment.success ? '成功' : '失敗'}</p>
    </article>
  )
}
