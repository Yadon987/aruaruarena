import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { loadComponent } from '../../../../test/mocks/framerMotion'

const loadJudgeSpeechBubble = () => loadComponent(() => import('../JudgeSpeechBubble'))

describe('JudgeSpeechBubble Refactor', () => {
  it('AnimatePresence 配下で表示・非表示を切り替えできる', async () => {
    const { JudgeSpeechBubble } = await loadJudgeSpeechBubble()
    const { rerender, queryByText } = render(
      <JudgeSpeechBubble isVisible={true} text="表示" judgeType="hiroyuki" />
    )

    expect(queryByText('表示')).toBeInTheDocument()

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
    expect(screen.getByRole('status').parentElement).toHaveClass('justify-start')
    nakao.unmount()
  })
})
