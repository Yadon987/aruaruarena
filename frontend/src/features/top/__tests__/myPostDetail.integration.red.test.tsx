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
const MY_POST_ID = '11111111-1111-4111-8111-111111111111'

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
      id: MY_POST_ID,
      nickname: '太郎',
      body: '本文1',
      status: 'scored',
      created_at: '2026-02-18T00:00:00Z',
      average_score: 95.3,
      rank: 1,
      total_count: 20,
    })
    localStorage.setItem('my_post_ids', JSON.stringify([MY_POST_ID]))

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '自分の投稿一覧' }))

    await waitFor(() => expect(getPostSpy).toHaveBeenCalledWith(MY_POST_ID))
    expect(await screen.findByText('本文1')).toBeInTheDocument()
    expect(screen.getByText('95.3')).toBeInTheDocument()
    expect(screen.getByText('1位')).toBeInTheDocument()
    expect(screen.getByText('2026-02-18T00:00:00Z')).toBeInTheDocument()
    expect(screen.getByText('scored')).toBeInTheDocument()
  })

  it('投稿クリック時に投稿一覧モーダルを閉じて審査結果モーダルへ切り替える', async () => {
    // 何を検証するか: 投稿選択時に一覧モーダルを閉じて結果モーダルへ遷移すること
    vi.spyOn(api.posts, 'get').mockResolvedValue({
      id: MY_POST_ID,
      nickname: '太郎',
      body: '本文1',
      status: 'scored',
      created_at: '2026-02-18T00:00:00Z',
      average_score: 95.3,
      rank: 1,
      total_count: 20,
    })
    localStorage.setItem('my_post_ids', JSON.stringify([MY_POST_ID]))

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '自分の投稿一覧' }))
    fireEvent.click(await screen.findByRole('button', { name: MY_POST_ID }))

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
    localStorage.setItem('my_post_ids', JSON.stringify([MY_POST_ID]))

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '自分の投稿一覧' }))
    fireEvent.click(await screen.findByRole('button', { name: MY_POST_ID }))

    expect(await screen.findByText('投稿詳細の取得に失敗しました')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '再試行' })).toBeInTheDocument()
  })

  it('my_post_idsが空配列のときは一覧事前取得APIを呼ばない', async () => {
    // 何を検証するか: 投稿IDが存在しない場合に不要な詳細取得リクエストを発生させないこと
    const getPostSpy = vi.spyOn(api.posts, 'get').mockResolvedValue({
      id: MY_POST_ID,
      nickname: '太郎',
      body: '本文1',
      status: 'scored',
      created_at: '2026-02-18T00:00:00Z',
      average_score: 95.3,
      rank: 1,
      total_count: 20,
    })
    localStorage.setItem('my_post_ids', JSON.stringify([]))

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '自分の投稿一覧' }))

    await screen.findByRole('heading', { name: '自分の投稿' })
    expect(getPostSpy).not.toHaveBeenCalled()
  })

  it('一覧事前取得は同時3件以内で実行する', async () => {
    // 何を検証するか: 投稿詳細の事前取得が最大3件同時実行の上限を守ること
    const ids = [
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      '33333333-3333-4333-8333-333333333333',
      '44444444-4444-4444-8444-444444444444',
      '55555555-5555-4555-8555-555555555555',
    ]
    localStorage.setItem('my_post_ids', JSON.stringify(ids))
    let inFlight = 0
    let maxInFlight = 0

    vi.spyOn(api.posts, 'get').mockImplementation(async (id: string) => {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 5))
      inFlight -= 1
      return {
        id,
        nickname: '太郎',
        body: `本文-${id}`,
        status: 'judging',
        created_at: '2026-02-18T00:00:00Z',
      }
    })

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '自分の投稿一覧' }))

    await waitFor(() => expect(maxInFlight).toBeGreaterThan(0))
    await waitFor(() => expect(maxInFlight).toBeLessThanOrEqual(3))
  })
})
