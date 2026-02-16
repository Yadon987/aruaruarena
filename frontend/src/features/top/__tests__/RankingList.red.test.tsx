import { render, screen } from '@testing-library/react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
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
  beforeEach(() => {
    mockedUseRankings.mockReturnValue({
      data: { rankings, total_count: 20 },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useRankings>)
  })

  it('トップ画面にランキング領域が表示される', async () => {
    // 何を検証するか: ランキング表示エリアがトップ画面に存在すること
    render(<App />)

    expect(await screen.findByRole('region', { name: 'ランキング表示エリア' })).toBeInTheDocument()
  })

  it('ランキングが20件表示される', async () => {
    // 何を検証するか: TOP20ランキングが一覧表示されること
    render(<App />)

    const rankingItems = await screen.findAllByTestId('ranking-item')
    expect(rankingItems).toHaveLength(20)
  })
})
