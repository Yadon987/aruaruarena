import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

describe('MyPostDetail Integration', () => {
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

  it('投稿IDクリック後に投稿詳細を表示する', async () => {
    // 何を検証するか: 投稿IDクリックで投稿詳細画面へ遷移すること
    vi.spyOn(api.posts, 'get').mockResolvedValue({
      id: 'id-1',
      nickname: '太郎',
      body: '本文1',
      status: 'scored',
      created_at: '2026-02-16T00:00:00Z',
      average_score: 95.3,
      rank: 1,
    })
    localStorage.setItem('my_post_ids', JSON.stringify(['id-1']))

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '自分の投稿一覧' }))
    fireEvent.click(await screen.findByRole('button', { name: 'id-1' }))

    const detail = await screen.findByRole('heading', { name: '投稿詳細' })
    const detailSection = detail.closest('section')
    expect(detailSection).not.toBeNull()
    const detailScope = within(detailSection as HTMLElement)
    expect(detailScope.getByText('太郎')).toBeInTheDocument()
    expect(detailScope.getByText('本文1')).toBeInTheDocument()
    expect(detailScope.getByText('審査完了')).toBeInTheDocument()
  })

  it('戻るボタンで投稿ID一覧へ戻る', async () => {
    // 何を検証するか: 詳細表示から戻る操作で一覧画面に復帰できること
    vi.spyOn(api.posts, 'get').mockResolvedValue({
      id: 'id-1',
      nickname: '太郎',
      body: '本文1',
      status: 'judging',
      created_at: '2026-02-16T00:00:00Z',
    })
    localStorage.setItem('my_post_ids', JSON.stringify(['id-1']))

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '自分の投稿一覧' }))
    fireEvent.click(await screen.findByRole('button', { name: 'id-1' }))
    fireEvent.click(await screen.findByRole('button', { name: '戻る' }))

    expect(await screen.findByRole('heading', { name: '自分の投稿' })).toBeInTheDocument()
    const dialog = await screen.findByRole('dialog', { name: '自分の投稿' })
    expect(within(dialog).getByRole('button', { name: 'id-1' })).toBeInTheDocument()
  })

  it('モーダル再オープン時は一覧を初期表示する', async () => {
    // 何を検証するか: 閉じる操作で詳細選択状態がリセットされること
    vi.spyOn(api.posts, 'get').mockResolvedValue({
      id: 'id-1',
      nickname: '太郎',
      body: '本文1',
      status: 'failed',
      created_at: '2026-02-16T00:00:00Z',
    })
    localStorage.setItem('my_post_ids', JSON.stringify(['id-1']))

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '自分の投稿一覧' }))
    fireEvent.click(await screen.findByRole('button', { name: 'id-1' }))
    const detailHeading = await screen.findByRole('heading', { name: '投稿詳細' })
    const detailSection = detailHeading.closest('section')
    expect(detailSection).not.toBeNull()
    fireEvent.click(within(detailSection as HTMLElement).getByRole('button', { name: '閉じる' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: '自分の投稿' })).not.toBeInTheDocument()
    )
    fireEvent.click(screen.getByRole('button', { name: '自分の投稿一覧' }))

    expect(await screen.findByRole('heading', { name: '自分の投稿' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '投稿詳細' })).not.toBeInTheDocument()
  })
})
