import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../../App'
import { useRankings } from '../../../shared/hooks/useRankings'
import { api } from '../../../shared/services/api'

vi.mock('@tanstack/react-query-devtools', () => ({
  ReactQueryDevtools: () => <div data-testid="react-query-devtools" />,
}))
vi.mock('../../../shared/hooks/useRankings', () => ({
  useRankings: vi.fn(),
}))

const mockedUseRankings = vi.mocked(useRankings)

describe('MyPostHighlight Refactor', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()

    mockedUseRankings.mockReturnValue({
      data: {
        rankings: [
          { rank: 1, id: 'id-1', nickname: '太郎', body: '本文1', average_score: 95.3 },
          { rank: 2, id: 'id-2', nickname: '次郎', body: '本文2', average_score: 94.2 },
        ],
        total_count: 2,
      },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useRankings>)
  })

  it('404以外の失敗時はmy_post_idsを復元する', async () => {
    // 何を検証するか: 取得失敗が404以外の場合は投稿IDが削除されず維持されること
    localStorage.setItem('my_post_ids', JSON.stringify(['id-1', 'id-2']))
    vi.spyOn(api.posts, 'get').mockRejectedValue({ status: 429, code: 'RATE_LIMITED' })

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '自分の投稿一覧' }))
    fireEvent.click(await screen.findByRole('button', { name: 'id-1' }))

    await screen.findByText('アクセスが集中しています。時間をおいて再度お試しください')

    await waitFor(() => {
      expect(localStorage.getItem('my_post_ids')).toBe(JSON.stringify(['id-1', 'id-2']))
    })
  })
})
