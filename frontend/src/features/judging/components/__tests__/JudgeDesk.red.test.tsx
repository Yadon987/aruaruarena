import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { loadComponent } from '../../../../test/mocks/framerMotion'

const loadJudgeDesk = () => loadComponent(() => import('../JudgeDesk'))

describe('E25-01 RED: JudgeDesk', () => {
  it('scoringフェーズで成功審査員の点数を表示する', async () => {
    // 何を検証するか: E25-01の受け入れ基準として、採点フェーズで成功した審査員の点数が表示されること
    const { JudgeDesk } = await loadJudgeDesk()

    render(
      <JudgeDesk
        phase="scoring"
        judgments={[
          { judge: 'nakao', score: 81, success: true },
          { judge: 'hiroyuki', score: 88, success: true },
          { judge: 'dewi', score: 93, success: true },
        ]}
      />
    )

    expect(screen.getByText('81')).toBeInTheDocument()
    expect(screen.getByText('88')).toBeInTheDocument()
    expect(screen.getByText('93')).toBeInTheDocument()
  })

  it('scoringフェーズで失敗審査員はN/Aを表示する', async () => {
    // 何を検証するか: E25-01の受け入れ基準として、success=false の審査員が N/A 表示になること
    const { JudgeDesk } = await loadJudgeDesk()

    render(
      <JudgeDesk
        phase="scoring"
        judgments={[
          { judge: 'nakao', score: 0, success: false },
          { judge: 'hiroyuki', score: 88, success: true },
          { judge: 'dewi', score: 0, success: false },
        ]}
      />
    )

    expect(screen.getAllByText('N/A')).toHaveLength(2)
  })

  it('scoringフェーズでスコアが左から順に点灯する', async () => {
    // 何を検証するか: E25-01の受け入れ基準として、点灯順が左→中央→右であること
    vi.useFakeTimers()
    const { JudgeDesk } = await loadJudgeDesk()

    render(
      <JudgeDesk
        phase="scoring"
        judgments={[
          { judge: 'nakao', score: 70, success: true },
          { judge: 'hiroyuki', score: 80, success: true },
          { judge: 'dewi', score: 90, success: true },
        ]}
      />
    )

    const panels = screen.getAllByTestId('judge-desk-score')
    expect(panels[0]).toHaveAttribute('data-lit', 'true')
    expect(panels[1]).toHaveAttribute('data-lit', 'true')
    expect(panels[2]).toHaveAttribute('data-lit', 'true')

    vi.useRealTimers()
  })
})
