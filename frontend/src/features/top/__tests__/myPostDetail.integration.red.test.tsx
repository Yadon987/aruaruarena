import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../../App'
import { useRankings } from '../../../shared/hooks/useRankings'
import { ApiClientError, api } from '../../../shared/services/api'

vi.mock('@tanstack/react-query-devtools', () => ({
  ReactQueryDevtools: () => <div data-testid="react-query-devtools" />,
}))
vi.mock('../../../shared/hooks/useRankings', () => ({
  useRankings: vi.fn(),
}))

const mockedUseRankings = vi.mocked(useRankings)

describe('E16-01 MyPostDetail Integration RED', () => {
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

  it('投稿一覧モーダル表示時に投稿詳細を取得して本文・平均点・順位・作成日時・ステータスを表示する', async () => {
    // 何を検証するか: 投稿一覧モーダルがIDだけでなく投稿詳細を表示できること
    const getPostSpy = vi.spyOn(api.posts, 'get').mockResolvedValue({
      id: 'id-1',
      nickname: '太郎',
      body: '本文1',
      status: 'scored',
      created_at: '2026-02-18T00:00:00Z',
      average_score: 95.3,
      rank: 1,
      total_count: 20,
    })
    localStorage.setItem('my_post_ids', JSON.stringify(['id-1']))

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '自分の投稿一覧' }))

    await waitFor(() => expect(getPostSpy).toHaveBeenCalledWith('id-1'))
    expect(await screen.findByText('本文1')).toBeInTheDocument()
    expect(screen.getByText('95.3')).toBeInTheDocument()
    expect(screen.getByText('1位')).toBeInTheDocument()
    expect(screen.getByText('2026-02-18T00:00:00Z')).toBeInTheDocument()
    expect(screen.getByText('scored')).toBeInTheDocument()
  })

  it('投稿クリック時に投稿一覧モーダルを閉じて審査結果モーダルへ切り替える', async () => {
    // 何を検証するか: 投稿選択時に一覧モーダルを閉じて結果モーダルへ遷移すること
    vi.spyOn(api.posts, 'get').mockResolvedValue({
      id: 'id-1',
      nickname: '太郎',
      body: '本文1',
      status: 'scored',
      created_at: '2026-02-18T00:00:00Z',
      average_score: 95.3,
      rank: 1,
      total_count: 20,
    })
    localStorage.setItem('my_post_ids', JSON.stringify(['id-1']))

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '自分の投稿一覧' }))
    fireEvent.click(await screen.findByRole('button', { name: 'id-1' }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: '自分の投稿' })).not.toBeInTheDocument()
    )
    expect(await screen.findByRole('dialog', { name: '審査結果モーダル' })).toBeInTheDocument()
  })

  it('500系失敗時は取得失敗メッセージと再試行ボタンを表示する', async () => {
    // 何を検証するか: 一時エラー時にユーザーが再試行できるUIを表示すること
    vi.spyOn(api.posts, 'get').mockRejectedValue(
      new ApiClientError('server error', 'INTERNAL_ERROR', 500)
    )
    localStorage.setItem('my_post_ids', JSON.stringify(['id-1']))

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '自分の投稿一覧' }))
    fireEvent.click(await screen.findByRole('button', { name: 'id-1' }))

    expect(await screen.findByText('投稿詳細の取得に失敗しました')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '再試行' })).toBeInTheDocument()
  })
})
