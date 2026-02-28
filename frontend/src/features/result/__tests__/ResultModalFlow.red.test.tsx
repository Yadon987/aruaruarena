import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../../App'
import { api } from '../../../shared/services/api'
import { mockRankings, selectMyPost } from '../../../test/appTestHelpers'

vi.mock('@tanstack/react-query-devtools', () => ({
  ReactQueryDevtools: () => <div data-testid="react-query-devtools" />,
}))
vi.mock('../../../shared/hooks/useRankings', () => ({
  useRankings: vi.fn(),
}))

describe('E15-01 RED: ResultModal Flow', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mockRankings([
      { rank: 1, id: 'rank-post-1', nickname: 'ランク太郎', body: '本文', average_score: 90.1 },
    ])
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

    await selectMyPost('my-post-id')

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

  it('TOP20圏外のscored投稿ではシェア関連UIを表示しない', async () => {
    // 何を検証するか: scoredでもrankが21位以降ならSNSシェアボタンとOGPプレビューを表示しないこと
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
      rank: 21,
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

    expect(screen.queryByRole('button', { name: 'Xでシェア' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('ogp-preview')).not.toBeInTheDocument()
  })

  it('再試行ボタン押下で同一idの再取得を1回実行する', async () => {
    // 何を検証するか: エラー表示中の再試行操作で同一投稿IDの再取得が1回だけ走ること
    const getPostSpy = vi
      .spyOn(api.posts, 'get')
      .mockRejectedValueOnce({ status: 500, code: 'INTERNAL_ERROR' })
      .mockResolvedValueOnce({
        id: 'rank-post-1',
        nickname: '再試行太郎',
        body: '再試行本文',
        status: 'scored',
        created_at: '2026-02-17T00:00:00Z',
        average_score: 77.7,
        rank: 8,
        total_count: 40,
        judgments: [],
      })

    render(<App />)

    fireEvent.click(screen.getByTestId('ranking-item'))
    fireEvent.click(await screen.findByRole('button', { name: '再試行' }))

    await waitFor(() => {
      expect(screen.getByText('平均点: 77.7')).toBeInTheDocument()
    })
    expect(getPostSpy).toHaveBeenNthCalledWith(1, 'rank-post-1')
    expect(getPostSpy).toHaveBeenNthCalledWith(2, 'rank-post-1')
    expect(getPostSpy).toHaveBeenCalledTimes(2)
  })
})

describe('E15-02 RED: ResultModal Action Buttons', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mockRankings([
      { rank: 1, id: 'rank-post-1', nickname: 'ランク太郎', body: '本文', average_score: 90.1 },
    ])
  })

  it('failed投稿で再審査ボタンを表示する', async () => {
    // 何を検証するか: status=failed の投稿詳細では再審査ボタンが表示されること
    vi.spyOn(api.posts, 'get').mockResolvedValue({
      id: 'failed-post-id',
      nickname: '失敗太郎',
      body: '失敗本文',
      status: 'failed',
      created_at: '2026-02-17T00:00:00Z',
      judgments: [],
    })

    render(<App />)

    fireEvent.click(screen.getByTestId('ranking-item'))

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: '審査結果モーダル' })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: '再審査する' })).toBeInTheDocument()
  })

  it('scored投稿でSNSシェアボタンを表示する', async () => {
    // 何を検証するか: status=scored かつ rank<=20 の投稿詳細ではSNSシェアボタンが表示されること
    vi.spyOn(api.posts, 'get').mockResolvedValue({
      id: 'scored-post-id',
      nickname: '成功太郎',
      body: '成功本文',
      status: 'scored',
      created_at: '2026-02-17T00:00:00Z',
      average_score: 88.8,
      rank: 3,
      total_count: 30,
      judgments: [],
    })

    render(<App />)

    fireEvent.click(screen.getByTestId('ranking-item'))

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: '審査結果モーダル' })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Xでシェア' })).toBeInTheDocument()
  })

  it('rankが20のscored投稿ではSNSシェアボタンを表示する', async () => {
    // 何を検証するか: rank=20はTOP20内としてSNSシェアボタンが表示されること
    vi.spyOn(api.posts, 'get').mockResolvedValue({
      id: 'top20-post-id',
      nickname: '境界太郎',
      body: '境界本文',
      status: 'scored',
      created_at: '2026-02-17T00:00:00Z',
      average_score: 80.1,
      rank: 20,
      total_count: 30,
      judgments: [],
    })

    render(<App />)

    fireEvent.click(screen.getByTestId('ranking-item'))

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: '審査結果モーダル' })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Xでシェア' })).toBeInTheDocument()
  })

  it('再審査ボタン押下でrejudge APIを1回呼ぶ', async () => {
    // 何を検証するか: 再審査ボタン押下で /api/posts/:id/rejudge が1回だけ呼ばれること
    vi.spyOn(api.posts, 'get').mockResolvedValue({
      id: 'rejudge-post-id',
      nickname: '再審査太郎',
      body: '再審査本文',
      status: 'failed',
      created_at: '2026-02-17T00:00:00Z',
      judgments: [],
    })
    const rejudgeSpy = vi.spyOn(api.posts, 'rejudge').mockResolvedValue({
      id: 'rejudge-post-id',
      status: 'judging',
    })

    render(<App />)
    fireEvent.click(screen.getByTestId('ranking-item'))

    const rejudgeButton = await screen.findByRole('button', { name: '再審査する' })
    fireEvent.click(rejudgeButton)

    await waitFor(() => {
      expect(rejudgeSpy).toHaveBeenCalledWith('rejudge-post-id')
    })
    expect(rejudgeSpy).toHaveBeenCalledTimes(1)
  })

  it('SNSシェア押下でOGPプレビュー表示後に安全な新規タブ起動を行う', async () => {
    // 何を検証するか: Xシェア押下時にOGPプレビューを表示し、noopener,noreferrer付きでwindow.openすること
    vi.spyOn(api.posts, 'get').mockResolvedValue({
      id: 'share-post-id',
      nickname: 'シェア太郎',
      body: 'シェア本文',
      status: 'scored',
      created_at: '2026-02-17T00:00:00Z',
      average_score: 96.1,
      rank: 1,
      total_count: 100,
      judgments: [],
    })
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    render(<App />)
    fireEvent.click(screen.getByTestId('ranking-item'))
    fireEvent.click(await screen.findByRole('button', { name: 'Xでシェア' }))

    expect(screen.getByTestId('ogp-preview')).toBeInTheDocument()
    expect(openSpy.mock.calls[0]?.[0]).toContain('https://x.com/intent/tweet?text=')
    expect(String(openSpy.mock.calls[0]?.[0])).toContain(
      encodeURIComponent('シェア本文 #あるあるアリーナ')
    )
    expect(openSpy).toHaveBeenCalledWith(expect.any(String), '_blank', 'noopener,noreferrer')
  })

  it('再審査API失敗時はjudgingへ遷移せずボタンが再押下可能になる', async () => {
    // 何を検証するか: 再審査APIが失敗した場合に審査中画面へ遷移せず、エラーメッセージ表示と再押下可能状態へ戻ること
    vi.spyOn(api.posts, 'get').mockResolvedValue({
      id: 'rejudge-failed-post-id',
      nickname: '失敗再審査太郎',
      body: '失敗再審査本文',
      status: 'failed',
      created_at: '2026-02-17T00:00:00Z',
      judgments: [],
    })
    vi.spyOn(api.posts, 'rejudge').mockRejectedValue(new Error('rejudge failed'))

    render(<App />)
    fireEvent.click(screen.getByTestId('ranking-item'))

    const rejudgeButton = await screen.findByRole('button', { name: '再審査する' })
    fireEvent.click(rejudgeButton)

    await waitFor(() => {
      expect(screen.queryByTestId('judging-screen')).not.toBeInTheDocument()
      expect(rejudgeButton).not.toBeDisabled()
      expect(
        screen.getByText('再審査に失敗しました。時間をおいて再度お試しください')
      ).toBeInTheDocument()
    })
  })
})
