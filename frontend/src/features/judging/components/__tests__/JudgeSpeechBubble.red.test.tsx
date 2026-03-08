import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadComponent } from '../../../../test/mocks/framerMotion'

const loadJudgeSpeechBubble = () => loadComponent(() => import('../JudgeSpeechBubble'))

describe('E24-05 RED: JudgeSpeechBubble', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('吹き出しが表示される', async () => {
    // 何を検証するか: isVisible=true のとき吹き出しが表示されること
    const { JudgeSpeechBubble } = await loadJudgeSpeechBubble()

    render(
      <JudgeSpeechBubble
        isVisible={true}
        text="それってあなたの感想ですよね"
        judgeType="hiroyuki"
      />
    )

    await act(async () => {
      vi.advanceTimersByTime(2500)
    })
    expect(screen.getByRole('status')).toHaveTextContent('それってあなたの感想ですよね')
  })

  it('isVisible=false で吹き出しが非表示', async () => {
    // 何を検証するか: isVisible=false のとき吹き出しが表示されないこと
    const { JudgeSpeechBubble } = await loadJudgeSpeechBubble()

    render(
      <JudgeSpeechBubble
        isVisible={false}
        text="それってあなたの感想ですよね"
        judgeType="hiroyuki"
      />
    )

    expect(screen.queryByText('それってあなたの感想ですよね')).not.toBeInTheDocument()
  })

  it('aria-live="polite" が設定される', async () => {
    // 何を検証するか: NFR-04 - スクリーンリーダーで口癖が読み上げられること
    const { JudgeSpeechBubble } = await loadJudgeSpeechBubble()

    render(
      <JudgeSpeechBubble
        isVisible={true}
        text="それってあなたの感想ですよね"
        judgeType="hiroyuki"
      />
    )

    const bubble = screen.getByRole('status')
    expect(bubble).toHaveAttribute('aria-live', 'polite')
  })

  it('複数行テキストが正しく折り返される（whitespace-normal）', async () => {
    // 何を検証するか: 長いセリフが正しく折り返されて表示されること
    const { JudgeSpeechBubble } = await loadJudgeSpeechBubble()
    const longText = '頭の悪い人には分からないかもしれないですけど'

    render(<JudgeSpeechBubble isVisible={true} text={longText} judgeType="hiroyuki" />)

    await act(async () => {
      vi.advanceTimersByTime(2500)
    })
    const bubble = screen.getByRole('status')
    expect(bubble).toHaveTextContent(longText)
    expect(bubble).toHaveClass('whitespace-normal')
  })

  it('審査員タイプに応じた位置に表示される', async () => {
    // 何を検証するか: 各審査員の位置に合わせて吹き出しが表示されること
    const { JudgeSpeechBubble } = await loadJudgeSpeechBubble()

    render(<JudgeSpeechBubble isVisible={true} text="テスト" judgeType="dewi" />)

    const dewiContainer = screen.getByRole('status').parentElement
    expect(dewiContainer).toHaveClass('justify-center')
  })
})
