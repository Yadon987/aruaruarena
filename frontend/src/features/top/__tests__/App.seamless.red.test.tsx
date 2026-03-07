import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../../App'
import { api } from '../../../shared/services/api'
import { fillAndSubmitPostForm, openPostDialog } from '../../../test/helpers'

vi.mock('../../mocks/browser', () => ({
  worker: {
    start: () => Promise.resolve(),
    stop: () => Promise.resolve(),
  },
}))

vi.mock('../../../shared/hooks/useRankings', () => ({
  useRankings: vi.fn(() => ({
    data: { rankings: [], total_count: 0 },
    isLoading: false,
    isError: false,
    error: null,
  })),
}))

const fillAndSubmitPost = async (nickname = 'テスト', body = 'テスト投稿') => {
  await fillAndSubmitPostForm({ nickname, body })
  await waitFor(() => {
    expect(api.posts.create).toHaveBeenCalledTimes(1)
    expect(api.posts.create).toHaveBeenCalledWith({ nickname, body })
  })

  // 投稿フォームモーダル（name: '投稿フォーム'）が閉じることを確認
  await waitFor(() => {
    expect(screen.queryByRole('dialog', { name: '投稿フォーム' })).not.toBeInTheDocument()
  })

  // ポーリングが開始され、審査中画面が表示されることを待機
  await waitFor(
    () => {
      expect(screen.getByText(/審査中/)).toBeInTheDocument()
    },
    { timeout: 5000 }
  )
}

describe('E24-07 RED: App Seamless UI Integration', () => {
  beforeEach(() => {
    vi.spyOn(api.posts, 'create').mockResolvedValue({
      id: 'seamless-post-id',
      status: 'judging',
    })
    // デフォルトは審査中状態を返す（ポーリング中の審査中画面を維持）
    vi.spyOn(api.posts, 'get').mockResolvedValue({
      id: 'seamless-post-id',
      nickname: 'テスト太郎',
      body: 'テスト本文',
      status: 'judging',
      created_at: '2026-03-01T00:00:00Z',
      average_score: 0,
      rank: 0,
      total_count: 10,
      judgments: [],
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('初期表示で審査員が背景に表示される', async () => {
    // 何を検証するか: FR-01 - 審査員3名が常に背景に表示されること
    render(<App />)

    const avatars = screen
      .getAllByRole('img')
      .filter((img) => img.getAttribute('alt')?.includes('審査員'))
    expect(avatars).toHaveLength(3)
  })

  it('投稿ボタンでモーダルが開く', async () => {
    // 何を検証するか: FR-04 - 投稿フォームがモーダルとして表示されること
    render(<App />)
    await openPostDialog()

    expect(await screen.findByRole('dialog', { name: '投稿フォーム' })).toBeInTheDocument()
  })

  it('モーダル中は口癖が表示されない', async () => {
    // 何を検証するか: FR-09 - モーダルオープン中は口癖表示を停止すること
    render(<App />)
    await openPostDialog()

    expect(await screen.findByRole('dialog', { name: '投稿フォーム' })).toBeInTheDocument()

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('投稿完了でモーダルが閉じ、審査中になる', async () => {
    // 何を検証するか: FR-05 - 投稿完了時、モーダルが閉じ審査員が口癖発話を開始すること
    render(<App />)
    await fillAndSubmitPost()

    await waitFor(() => {
      expect(screen.getByText(/審査中/)).toBeInTheDocument()
    })
  })

  it('審査中に投稿内容（ニックネーム・本文）が表示される', async () => {
    // 何を検証するか: FR-07 - 審査中の投稿内容が画面表示されること
    // モックデータ（テスト太郎等）と被らない意図的な別データ
    const inputNickname = '独自のニックネーム'
    const inputBody = '独自のあるある投稿内容'

    vi.mocked(api.posts.get).mockResolvedValue({
      id: 'seamless-post-id',
      nickname: inputNickname,
      body: inputBody,
      status: 'judging',
      created_at: '2026-03-01T00:00:00Z',
      average_score: 0,
      rank: 0,
      total_count: 10,
      judgments: [],
    })

    render(<App />)

    await fillAndSubmitPost(inputNickname, inputBody)

    await waitFor(() => {
      // APIが返した審査中データ（このテストでは入力値と同値）を画面表示できることを確認
      expect(screen.getByText(inputNickname)).toBeInTheDocument()
      expect(screen.getByText(inputBody)).toBeInTheDocument()
    })
  })

  it('審査中に口癖が表示される', async () => {
    // 何を検証するか: FR-06 - 審査中に口癖発話が表示されること
    vi.mocked(api.posts.get).mockResolvedValueOnce({
      id: 'seamless-post-id',
      nickname: 'テスト太郎',
      body: 'テスト本文',
      status: 'judging',
      created_at: '2026-03-01T00:00:00Z',
      average_score: 0,
      rank: 0,
      total_count: 10,
      judgments: [],
    })

    render(<App />)
    await fillAndSubmitPost()

    // 審査中画面では初期状態でもひろゆきのフォールバック吹き出しが表示される
    expect(await screen.findByTestId('catchphrase-hiroyuki')).toBeInTheDocument()
  })

  it('審査完了で結果モーダルが表示される', { timeout: 15000 }, async () => {
    // 何を検証するか: FR-08 - 審査完了時、結果モーダルが表示されること
    // 審査完了状態を返すようにモックを上書き
    vi.mocked(api.posts.get).mockResolvedValue({
      id: 'seamless-post-id',
      nickname: 'テスト太郎',
      body: 'テスト本文',
      status: 'scored',
      created_at: '2026-03-01T00:00:00Z',
      average_score: 90.0,
      rank: 1,
      total_count: 10,
      judgments: [],
    })

    render(<App />)
    // fillAndSubmitPostは審査中画面を待機するが、即座にscoredになる場合は
    // 審査中画面をスキップして結果モーダルが開くため、直接フォーム送信を使用
    await fillAndSubmitPostForm({ nickname: 'テスト', body: 'テスト投稿' })

    await waitFor(
      () => {
        expect(screen.queryByRole('dialog', { name: '投稿フォーム' })).not.toBeInTheDocument()
        expect(screen.getByRole('dialog', { name: /審査結果/ })).toBeInTheDocument()
      },
      { timeout: 10000 }
    )
  })

  it('結果モーダル表示後、審査員は待機状態に戻る', { timeout: 15000 }, async () => {
    // 何を検証するか: FR-08 - 審査完了時、審査員は待機状態に戻ること
    // 審査完了状態を返すようにモックを上書き
    vi.mocked(api.posts.get).mockResolvedValue({
      id: 'seamless-post-id',
      nickname: 'テスト太郎',
      body: 'テスト本文',
      status: 'scored',
      created_at: '2026-03-01T00:00:00Z',
      average_score: 90.0,
      rank: 1,
      total_count: 10,
      judgments: [],
    })

    render(<App />)
    // fillAndSubmitPostは審査中画面を待機するが、即座にscoredになる場合は
    // 審査中画面をスキップして結果モーダルが開くため、直接フォーム送信を使用
    await fillAndSubmitPostForm({ nickname: 'テスト', body: 'テスト投稿' })

    await waitFor(
      () => {
        expect(screen.queryByRole('dialog', { name: '投稿フォーム' })).not.toBeInTheDocument()
        expect(screen.getByRole('dialog', { name: /審査結果/ })).toBeInTheDocument()
      },
      { timeout: 10000 }
    )

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
