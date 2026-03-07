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

  it('審査員ごとにネオンボーダーとネオンテキストが適用される', async () => {
    // 何を検証するか: Issue #150 のカラー要件（中尾=シアン、ひろゆき=ピンク、デヴィ=シアン）を満たすこと
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
    expect(panels[0]).toHaveClass('neon-border-cyan')
    expect(panels[1]).toHaveClass('neon-border-pink')
    expect(panels[2]).toHaveClass('neon-border-cyan')

    expect(within(panels[0]).getByText('85')).toHaveClass('neon-text-cyan')
    expect(within(panels[1]).getByText('92')).toHaveClass('neon-text-pink')
    expect(within(panels[2]).getByText('78')).toHaveClass('neon-text-cyan')
  })

  it('スコアの数値と単位「点」を表示しaria-labelにも「点」を含む', async () => {
    // 何を検証するか: Issue #150 のスコア表示要件（単位表示とアクセシビリティ）を満たすこと
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
    expect(screen.getAllByText('点')).toHaveLength(3)
  })

  it('未確定と失敗でも「点」を表示しルートとパネルのglass-panel適用位置が正しい', async () => {
    // 何を検証するか: Issue #150 の台座分離要件と境界表示（---/N-A）を満たすこと
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

    expect(within(panels[0]).getByText('N/A')).toBeInTheDocument()
    expect(within(panels[1]).getByText('---')).toBeInTheDocument()
    expect(within(panels[2]).getByText('---')).toBeInTheDocument()
    expect(screen.getAllByText('点')).toHaveLength(3)
  })
})
