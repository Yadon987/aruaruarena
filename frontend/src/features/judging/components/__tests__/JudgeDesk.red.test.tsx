import { act, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadComponent } from '../../../../test/mocks/framerMotion'

const loadJudgeDesk = () => loadComponent(() => import('../JudgeDesk'))

describe('E25-01 RED: JudgeDesk', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('scoringフェーズで成功審査員の点数を表示する', async () => {
    // 何を検証するか: E25-01の受け入れ基準として、採点フェーズで2桁のルーレット表示になること
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

    const panels = screen.getAllByTestId('judge-desk-score')
    panels.forEach((panel) => {
      expect(within(panel).getByText(/^\d{2}$/)).toBeInTheDocument()
      expect(panel).toHaveClass('score-rouletting')
    })
  })

  it('scoringフェーズで失敗審査員は失敗を表示する', async () => {
    // 何を検証するか: E25-01の受け入れ基準として、success=false の審査員が失敗表示になること
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

    expect(screen.getAllByText('失敗')).toHaveLength(2)
  })

  it('scoringフェーズでスコアが左から順に点灯する', async () => {
    // 何を検証するか: E25-01の受け入れ基準として、scoringフェーズ時に300ms間隔で左→中央→右へ点灯が進むこと
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
    expect(panels[1]).toHaveAttribute('data-lit', 'false')
    expect(panels[2]).toHaveAttribute('data-lit', 'false')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
    expect(panels[1]).toHaveAttribute('data-lit', 'true')
    expect(panels[2]).toHaveAttribute('data-lit', 'false')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
    expect(panels[2]).toHaveAttribute('data-lit', 'true')
  })

  it('審査員ごとにゴールドボーダーとゴールドテキストが適用される', async () => {
    // 何を検証するか: VIPゴールド配色が全審査員パネルに適用されること
    const { JudgeDesk } = await loadJudgeDesk()

    render(
      <JudgeDesk
        phase="complete"
        judgments={[
          { judge: 'nakao', score: 85, success: true },
          { judge: 'hiroyuki', score: 92, success: true },
          { judge: 'dewi', score: 78, success: true },
        ]}
      />
    )

    const panels = screen.getAllByTestId('judge-desk-score')
    expect(panels[0]).toHaveClass('gold-border')
    expect(panels[1]).toHaveClass('gold-border')
    expect(panels[2]).toHaveClass('gold-border')

    expect(within(panels[0]).getByText('85')).toHaveClass('gold-text')
    expect(within(panels[1]).getByText('92')).toHaveClass('gold-text')
    expect(within(panels[2]).getByText('78')).toHaveClass('gold-text')
  })

  it('スコアの数値と単位「点」を表示しaria-labelにも「点」を含む', async () => {
    // 何を検証するか: Issue #150 のスコア表示要件（アクセシビリティラベル）を満たすこと
    const { JudgeDesk } = await loadJudgeDesk()

    render(
      <JudgeDesk
        phase="complete"
        judgments={[
          { judge: 'nakao', score: 8.5, success: true },
          { judge: 'hiroyuki', score: 0, success: true },
          { judge: 'dewi', score: 10, success: true },
        ]}
      />
    )

    expect(screen.getByLabelText('中尾彬審査員のスコア: 8.5点')).toBeInTheDocument()
    expect(screen.getByLabelText('ひろゆき審査員のスコア: 0点')).toBeInTheDocument()
    expect(screen.getByLabelText('デヴィ婦人審査員のスコア: 10点')).toBeInTheDocument()
    expect(screen.queryByText('点')).not.toBeInTheDocument()
  })

  it('未確定と失敗でも「点」を表示しルートとパネルのglass-panel適用位置が正しい', async () => {
    // 何を検証するか: Issue #150 の台座分離要件と境界表示（00/失敗）を満たすこと
    const { JudgeDesk } = await loadJudgeDesk()

    render(
      <JudgeDesk
        phase="speaking"
        judgments={[{ judge: 'nakao', success: false }, { judge: 'hiroyuki' }]}
      />
    )

    const desk = screen.getByTestId('judge-desk')
    expect(desk).not.toHaveClass('glass-panel')

    const panels = screen.getAllByTestId('judge-desk-score')
    panels.forEach((panel) => {
      expect(panel).toHaveClass('glass-panel')
    })

    expect(within(panels[0]).getByText('失敗')).toBeInTheDocument()
    expect(within(panels[1]).getByText('00')).toBeInTheDocument()
    expect(within(panels[2]).getByText('00')).toBeInTheDocument()
    expect(screen.queryByText('点')).not.toBeInTheDocument()
  })
})
