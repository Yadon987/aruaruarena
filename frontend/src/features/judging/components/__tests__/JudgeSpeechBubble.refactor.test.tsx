import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadComponent } from '../../../../test/mocks/framerMotion'

const loadJudgeSpeechBubble = () => loadComponent(() => import('../JudgeSpeechBubble'))

describe('JudgeSpeechBubble Refactor', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('AnimatePresence 配下で表示・非表示を切り替えできる', async () => {
    const { JudgeSpeechBubble } = await loadJudgeSpeechBubble()
    const { rerender, queryByText } = render(
      <JudgeSpeechBubble isVisible={true} text="表示" judgeType="hiroyuki" />
    )

    await act(async () => {
      vi.advanceTimersByTime(2500)
    })
    expect(screen.getByRole('status')).toHaveTextContent('表示')

    rerender(<JudgeSpeechBubble isVisible={false} text="表示" judgeType="hiroyuki" />)
    expect(queryByText('表示')).not.toBeInTheDocument()
  })

  it('審査員タイプごとに位置クラスが適用される', async () => {
    const { JudgeSpeechBubble } = await loadJudgeSpeechBubble()

    const hiroyuki = render(
      <JudgeSpeechBubble isVisible={true} text="hiroyuki" judgeType="hiroyuki" />
    )
    expect(screen.getByRole('status').parentElement).toHaveClass('justify-center')
    hiroyuki.unmount()

    const dewi = render(<JudgeSpeechBubble isVisible={true} text="dewi" judgeType="dewi" />)
    expect(screen.getByRole('status').parentElement).toHaveClass('justify-center')
    dewi.unmount()

    const nakao = render(<JudgeSpeechBubble isVisible={true} text="nakao" judgeType="nakao" />)
    expect(screen.getByRole('status').parentElement).toHaveClass('justify-center')
    nakao.unmount()
  })
})
