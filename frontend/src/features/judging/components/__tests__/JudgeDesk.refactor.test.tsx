import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { loadComponent } from '../../../../test/mocks/framerMotion'

const loadJudgeDesk = () => loadComponent(() => import('../JudgeDesk'))

describe('JudgeDesk Refactor', () => {
  it('judgments が undefined でもプレースホルダーを表示する', async () => {
    // 何を検証するか: データ欠損時でもクラッシュせず既定表示になること
    const { JudgeDesk } = await loadJudgeDesk()

    render(<JudgeDesk phase="speaking" judgments={undefined} />)

    const panels = screen.getAllByTestId('judge-desk-score')
    expect(panels).toHaveLength(3)
    expect(screen.getAllByText('---')).toHaveLength(3)
  })

  it('scoring以外のフェーズでは点灯状態をfalseで返す', async () => {
    // 何を検証するか: 点灯演出はscoringフェーズに限定されること
    const { JudgeDesk } = await loadJudgeDesk()

    render(
      <JudgeDesk
        phase="complete"
        judgments={[
          { judge: 'nakao', score: 70, success: true },
          { judge: 'hiroyuki', score: 80, success: true },
          { judge: 'dewi', score: 90, success: true },
        ]}
      />
    )

    const panels = screen.getAllByTestId('judge-desk-score')
    panels.forEach((panel, index) => {
      expect(panel, `panel[${index}]`).toHaveAttribute('data-lit', 'false')
    })
  })

  it('compact=true の場合はコンパクト用クラスを適用する', async () => {
    // 何を検証するか: 小型アバター表示時にデスク幅も縮小されること
    const { JudgeDesk } = await loadJudgeDesk()

    render(<JudgeDesk phase="complete" compact={true} />)

    const desk = screen.getByTestId('judge-desk')
    expect(desk).toHaveClass('judge-desk-shell-compact')
  })
})
