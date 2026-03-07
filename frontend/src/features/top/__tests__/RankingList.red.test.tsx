import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
const rankings = Array.from({ length: 20 }, (_, i) => ({
  rank: i + 1,
  id: `id-${i + 1}`,
  nickname: `user-${i + 1}`,
  body: `body-${i + 1}`,
  average_score: 90 - i * 0.1,
}))

describe('RankingList RED', () => {
  async function openRankingModal() {
    fireEvent.click(screen.getByRole('button', { name: 'ランキング' }))
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'ランキング' })).toBeInTheDocument()
    })
  }

  beforeEach(() => {
    mockedUseRankings.mockReturnValue({
      data: { rankings, total_count: 20 },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useRankings>)
  })

  it('トップ画面にランキング領域が表示される', async () => {
    // 何を検証するか: トップ画面にランキングボタンが存在すること
    render(<App />)

    expect(await screen.findByRole('button', { name: 'ランキング' })).toBeInTheDocument()
  })

  it('ランキングが20件表示される', async () => {
    // 何を検証するか: モーダル開封後にTOP20ランキングが一覧表示されること
    render(<App />)
    await openRankingModal()

    const rankingItems = await screen.findAllByTestId('ranking-item')
    expect(rankingItems).toHaveLength(20)
  })
})
