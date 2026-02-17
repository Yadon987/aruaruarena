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

function setupRanking() {
  mockedUseRankings.mockReturnValue({
    data: {
      rankings: [{ rank: 1, id: 'rank-post-1', nickname: 'ランク太郎', body: '本文', average_score: 90.1 }],
      total_count: 1,
    },
    isLoading: false,
    isError: false,
    error: null,
  } as ReturnType<typeof useRankings>)
}

describe('E15-01 RED: ResultModal Flow', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    setupRanking()
  })

  it('ランキング項目クリックで結果モーダルが開く', async () => {
    // 何を検証するか: ランキングクリックを起点に審査結果モーダルが表示されること
    render(<App />)

    fireEvent.click(screen.getByTestId('ranking-item'))

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: '審査結果モーダル' })).toBeInTheDocument()
    })
  })

  it('審査中からscoredへ遷移した際に結果モーダルが開く', async () => {
    // 何を検証するか: 審査中画面でscoredを受信したら結果モーダルが表示されること
    vi.spyOn(api.posts, 'create').mockResolvedValue({
      id: 'flow-post-id',
      status: 'judging',
    })
    vi.spyOn(api.posts, 'get').mockResolvedValue({
      id: 'flow-post-id',
      nickname: '遷移太郎',
      body: '遷移本文',
      status: 'scored',
      created_at: '2026-02-17T00:00:00Z',
      average_score: 88.8,
      rank: 3,
      total_count: 12,
      judgments: [],
    })

    render(<App />)

    fireEvent.change(screen.getByLabelText('ニックネーム'), { target: { value: '遷移太郎' } })
    fireEvent.change(screen.getByLabelText('あるある本文'), { target: { value: '遷移テスト本文です' } })
    fireEvent.click(screen.getByRole('button', { name: '投稿する' }))

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: '審査結果モーダル' })).toBeInTheDocument()
    })
  })

  it('自分の投稿選択で結果モーダルが開く', async () => {
    // 何を検証するか: 自分の投稿一覧から投稿を選択した際に結果モーダルが表示されること
    localStorage.setItem('my_post_ids', JSON.stringify(['my-post-id']))
    vi.spyOn(api.posts, 'get').mockResolvedValue({
      id: 'my-post-id',
      nickname: '自分太郎',
      body: '自分本文',
      status: 'scored',
      created_at: '2026-02-17T00:00:00Z',
      average_score: 86.5,
      rank: 4,
      total_count: 14,
      judgments: [],
    })

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '自分の投稿一覧' }))
    fireEvent.click(await screen.findByRole('button', { name: 'my-post-id' }))

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: '審査結果モーダル' })).toBeInTheDocument()
    })
  })

  it('閉じるボタンとEscで結果モーダルを閉じる', async () => {
    // 何を検証するか: 閉じるボタンとEscキーでモーダルが閉じること
    vi.spyOn(api.posts, 'create').mockResolvedValue({
      id: 'close-post-id',
      status: 'judging',
    })
    vi.spyOn(api.posts, 'get').mockResolvedValue({
      id: 'close-post-id',
      nickname: '閉じる太郎',
      body: '閉じる本文',
      status: 'scored',
      created_at: '2026-02-17T00:00:00Z',
      average_score: 93.2,
      rank: 1,
      total_count: 9,
      judgments: [],
    })

    render(<App />)

    fireEvent.change(screen.getByLabelText('ニックネーム'), { target: { value: '閉じる太郎' } })
    fireEvent.change(screen.getByLabelText('あるある本文'), { target: { value: '閉じるテスト本文です' } })
    fireEvent.click(screen.getByRole('button', { name: '投稿する' }))

    const modal = await screen.findByRole('dialog', { name: '審査結果モーダル' })
    fireEvent.keyDown(modal, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '審査結果モーダル' })).not.toBeInTheDocument()
    })
  })

  it('Issue 1範囲外の再審査・SNSシェア・OGPを表示しない', async () => {
    // 何を検証するか: Issue 1では再審査ボタン・SNSシェア・OGPプレビューが表示されないこと
    vi.spyOn(api.posts, 'create').mockResolvedValue({
      id: 'scope-post-id',
      status: 'judging',
    })
    vi.spyOn(api.posts, 'get').mockResolvedValue({
      id: 'scope-post-id',
      nickname: '範囲太郎',
      body: '範囲本文',
      status: 'scored',
      created_at: '2026-02-17T00:00:00Z',
      average_score: 70.3,
      rank: 7,
      total_count: 30,
      judgments: [],
    })

    render(<App />)

    fireEvent.change(screen.getByLabelText('ニックネーム'), { target: { value: '範囲太郎' } })
    fireEvent.change(screen.getByLabelText('あるある本文'), { target: { value: '範囲テスト本文です' } })
    fireEvent.click(screen.getByRole('button', { name: '投稿する' }))

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: '審査結果モーダル' })).toBeInTheDocument()
    })

    expect(screen.queryByRole('button', { name: '再審査する' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Xでシェア' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('ogp-preview')).not.toBeInTheDocument()
  })
})
