import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../../App'
import { useRankings } from '../../../shared/hooks/useRankings'

vi.mock('@tanstack/react-query-devtools', () => ({
  ReactQueryDevtools: () => <div data-testid="react-query-devtools" />,
}))
vi.mock('../../../shared/hooks/useRankings', () => ({
  useRankings: vi.fn(),
}))

const mockedUseRankings = vi.mocked(useRankings)

describe('E16-01 MyPost Accessibility RED', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()

    mockedUseRankings.mockReturnValue({
      data: {
        rankings: [{ rank: 1, id: 'id-1', nickname: '太郎', body: '本文1', average_score: 95.3 }],
        total_count: 1,
      },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useRankings>)
  })

  it('投稿一覧モーダルを閉じたらトリガーボタンへフォーカスを戻す', async () => {
    // 何を検証するか: モーダルを閉じた後のフォーカス復帰が成立すること
    render(<App />)

    const trigger = screen.getByRole('button', { name: '自分の投稿一覧' })
    fireEvent.click(trigger)
    fireEvent.click(await screen.findByRole('button', { name: '閉じる' }))

    expect(trigger).toHaveFocus()
  })
})
