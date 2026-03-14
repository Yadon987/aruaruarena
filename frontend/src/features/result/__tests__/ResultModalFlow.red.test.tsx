import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../../App'
import { api } from '../../../shared/services/api'
import { mockRankings, selectMyPost } from '../../../test/appTestHelpers'
import { fillAndSubmitPostForm } from '../../../test/helpers'

vi.mock('@tanstack/react-query-devtools', () => ({
  ReactQueryDevtools: () => <div data-testid="react-query-devtools" />,
}))
vi.mock('../../../shared/hooks/useRankings', () => ({
  useRankings: vi.fn(),
}))

async function openRankingResultFromTopRanking() {
  fireEvent.click(screen.getByRole('button', { name: 'ランキング' }))
  await waitFor(() => {
    expect(screen.getByRole('dialog', { name: 'ランキング' })).toBeInTheDocument()
  })
  fireEvent.click(screen.getByTestId('ranking-item'))
}

describe('E15-01 RED: ResultModal Flow', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true } as Response))
    vi.spyOn(window, 'open').mockImplementation(() => null)
    mockRankings([
      {
        rank: 1,
        id: 'rank-post-1',
        nickname: 'ランク太郎',
        body: '本文',
        average_score: 90.1,
      },
    ])
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('ランキング項目クリックで結果モーダルが開く', async () => {
    // 何を検証するか: ランキングクリックを起点に審査結果モーダルが表示されること
    render(<App />)

    await openRankingResultFromTopRanking()

    await waitFor(
      () => {
        expect(screen.getByRole('dialog', { name: '審査結果モーダル' })).toBeInTheDocument()
      },
      { timeout: 9000 }
    )
  })

  it('ランキング投稿のstatusが未確定でも採点詳細モーダルを保てる', async () => {
    vi.spyOn(api.posts, 'get').mockResolvedValue({
      id: 'rank-post-1',
      nickname: 'ランク太郎',
      body: '本文',
      status: 'judging',
      created_at: '2026-02-17T00:00:00Z',
    })

    render(<App />)

    await openRankingResultFromTopRanking()

    expect(await screen.findByRole('dialog', { name: '審査結果モーダル' })).toBeInTheDocument()

    expect(
      await screen.findByText(
        '採点結果がまだ確定していません。しばらく時間をおいて再試行してください。'
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '再試行' })).toBeInTheDocument()
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

    await fillAndSubmitPostForm({ nickname: '遷移太郎', body: '遷移テスト本文です' })

    await waitFor(
      () => {
        expect(screen.getByRole('dialog', { name: '審査結果モーダル' })).toBeInTheDocument()
      },
      { timeout: 9000 }
    )
  }, 12000)

  it('審査完了が早くても結果表示は最低7.5秒待つ', async () => {
    vi.useFakeTimers()
    vi.spyOn(api.posts, 'create').mockResolvedValue({
      id: 'minimum-duration-post-id',
      status: 'judging',
    })
    vi.spyOn(api.posts, 'get').mockResolvedValue({
      id: 'minimum-duration-post-id',
      nickname: '待機太郎',
      body: '待機本文',
      status: 'scored',
      created_at: '2026-03-13T00:00:00Z',
      average_score: 84.2,
      rank: 6,
      total_count: 18,
      judgments: [],
    })

    render(<App />)

    // fake timers 環境では fillAndSubmitPostForm の非同期待機が不安定なためインラインで操作する。
    fireEvent.click(screen.getByRole('button', { name: '投稿する' }))
    fireEvent.change(screen.getByLabelText('ニックネーム'), {
      target: { value: '待機太郎' },
    })
    fireEvent.change(screen.getByLabelText('あるある'), {
      target: { value: '最低審査時間テスト本文です' },
    })
    fireEvent.click(screen.getByRole('button', { name: '投稿' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(screen.getByTestId('judging-screen')).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(7400)
    })

    expect(screen.queryByRole('dialog', { name: '審査結果モーダル' })).not.toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(screen.getByRole('dialog', { name: '審査結果モーダル' })).toBeInTheDocument()
  }, 12000)

  it('7.5秒経過後に審査完了した場合は追加待機なしで結果表示する', async () => {
    vi.useFakeTimers()
    vi.spyOn(api.posts, 'create').mockResolvedValue({
      id: 'slow-minimum-duration-post-id',
      status: 'judging',
    })
    vi.spyOn(api.posts, 'get').mockImplementation(
      async () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              id: 'slow-minimum-duration-post-id',
              nickname: '待機太郎',
              body: '待機本文',
              status: 'scored',
              created_at: '2026-03-13T00:00:00Z',
              average_score: 92.4,
              rank: 2,
              total_count: 18,
              judgments: [],
            })
          }, 8000)
        })
    )

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '投稿する' }))
    fireEvent.change(screen.getByLabelText('ニックネーム'), {
      target: { value: '待機太郎' },
    })
    fireEvent.change(screen.getByLabelText('あるある'), {
      target: { value: '遅延完了テスト本文です' },
    })
    fireEvent.click(screen.getByRole('button', { name: '投稿' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(7999)
    })

    expect(screen.queryByRole('dialog', { name: '審査結果モーダル' })).not.toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(screen.getByRole('dialog', { name: '審査結果モーダル' })).toBeInTheDocument()
  }, 12000)

  it('審査直後のscored結果では共有ボタン群を表示し、シェア画像押下時のみOGPを表示する', async () => {
    // 何を検証するか: 審査直後にscoredなら順位に関係なく共有導線を出し、OGPは明示操作まで隠すこと
    vi.spyOn(api.posts, 'create').mockResolvedValue({
      id: 'share-post-id',
      status: 'judging',
    })
    vi.spyOn(api.posts, 'get').mockResolvedValue({
      id: 'share-post-id',
      nickname: '共有太郎',
      body: '共有本文',
      status: 'scored',
      created_at: '2026-02-17T00:00:00Z',
      average_score: 91.4,
      rank: 3,
      total_count: 20,
      judgments: [],
    })

    render(<App />)

    await fillAndSubmitPostForm({ nickname: '共有太郎', body: '共有テスト本文です' })

    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: 'シェア画像を表示' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Xでシェア' })).toBeInTheDocument()
      },
      { timeout: 9000 }
    )
    expect(screen.queryByTestId('ogp-preview')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'シェア画像を表示' }))

    expect(screen.getByTestId('ogp-preview')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Xでシェア' }))

    expect(window.open).toHaveBeenCalledWith(expect.any(String), '_blank', 'noopener,noreferrer')
    const [shareIntentUrl] = vi.mocked(window.open).mock.calls[0] as [string]
    expect(shareIntentUrl).toContain('https://twitter.com/intent/tweet?')
    expect(decodeURIComponent(shareIntentUrl)).toContain('/posts/share-post-id')
    expect(screen.getByTestId('ogp-preview')).toHaveAttribute(
      'src',
      expect.stringContaining('/ogp/posts/share-post-id.png')
    )
  }, 12000)

  it('自分の投稿選択で結果モーダルが開く', async () => {
    // 何を検証するか: 過去の投稿から投稿を選択した際に結果モーダルが表示されること
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

    await waitFor(
      () => {
        expect(screen.getByRole('dialog', { name: '審査結果モーダル' })).toBeInTheDocument()
      },
      { timeout: 9000 }
    )
  })

  it('自分の投稿経由ではトップへではなく戻るボタンを表示し、一覧モーダルへ戻れる', async () => {
    // 何を検証するか: 過去の投稿から開いた結果モーダルだけ特別に一覧復帰導線へ差し替わること
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

    const resultModal = await screen.findByRole('dialog', { name: '審査結果モーダル' })
    expect(
      within(resultModal).getByRole('button', { name: '自分の投稿へ戻る' })
    ).toBeInTheDocument()
    expect(within(resultModal).queryByRole('button', { name: 'トップへ' })).not.toBeInTheDocument()

    fireEvent.click(within(resultModal).getByRole('button', { name: '自分の投稿へ戻る' }))

    const myPostsDialog = await screen.findByRole('dialog', { name: '自分の投稿' })
    expect(within(myPostsDialog).getByRole('button', { name: /投稿詳細を開く/ })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: '審査結果モーダル' })).not.toBeInTheDocument()
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

    await fillAndSubmitPostForm({ nickname: '閉じる太郎', body: '閉じるテスト本文です' })

    const modal = await screen.findByRole(
      'dialog',
      {
        name: '審査結果モーダル',
      },
      { timeout: 9000 }
    )
    fireEvent.keyDown(modal, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '審査結果モーダル' })).not.toBeInTheDocument()
    })
  }, 12000)

  it('TOP20圏外のscored投稿ではシェア関連UIを表示しない', async () => {
    // 何を検証するか: 審査直後でも rank が 21 位以降なら共有UIを表示しないこと
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

    await fillAndSubmitPostForm({ nickname: '範囲太郎', body: '範囲テスト本文です' })

    await waitFor(
      () => {
        expect(screen.getByRole('dialog', { name: '審査結果モーダル' })).toBeInTheDocument()
      },
      { timeout: 9000 }
    )

    expect(screen.queryByRole('button', { name: 'Xでシェア' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'シェア画像を表示' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('ogp-preview')).not.toBeInTheDocument()
  }, 12000)

  it('60.1点のscored投稿では高得点演出を表示する', async () => {
    // 何を検証するか: average_score が 60 を超える場合だけ高得点演出を表示すること
    vi.spyOn(api.posts, 'create').mockResolvedValue({
      id: 'high-score-post-id',
      status: 'judging',
    })
    vi.spyOn(api.posts, 'get').mockResolvedValue({
      id: 'high-score-post-id',
      nickname: '高得点太郎',
      body: '高得点本文',
      status: 'scored',
      created_at: '2026-03-14T00:00:00Z',
      average_score: 60.1,
      rank: 12,
      total_count: 30,
      judgments: [],
    })

    render(<App />)

    await fillAndSubmitPostForm({ nickname: '高得点太郎', body: '高得点演出テスト本文です' })

    await waitFor(
      () => {
        expect(screen.getByRole('dialog', { name: '審査結果モーダル' })).toBeInTheDocument()
      },
      { timeout: 9000 }
    )

    expect(screen.getByTestId('high-score-badge')).toBeInTheDocument()
    expect(screen.getByTestId('high-score-flash')).toBeInTheDocument()
    expect(screen.getByTestId('high-score-confetti')).toBeInTheDocument()
  }, 12000)

  it('60.0点のscored投稿では高得点演出を表示しない', async () => {
    // 何を検証するか: average_score が 60 ちょうどでは高得点扱いにならないこと
    vi.spyOn(api.posts, 'create').mockResolvedValue({
      id: 'boundary-score-post-id',
      status: 'judging',
    })
    vi.spyOn(api.posts, 'get').mockResolvedValue({
      id: 'boundary-score-post-id',
      nickname: '境界太郎',
      body: '境界本文',
      status: 'scored',
      created_at: '2026-03-14T00:00:00Z',
      average_score: 60.0,
      rank: 15,
      total_count: 30,
      judgments: [],
    })

    render(<App />)

    await fillAndSubmitPostForm({ nickname: '境界太郎', body: '境界値テスト本文です' })

    await waitFor(
      () => {
        expect(screen.getByRole('dialog', { name: '審査結果モーダル' })).toBeInTheDocument()
      },
      { timeout: 9000 }
    )

    expect(screen.queryByTestId('high-score-badge')).not.toBeInTheDocument()
    expect(screen.queryByTestId('high-score-flash')).not.toBeInTheDocument()
    expect(screen.queryByTestId('high-score-confetti')).not.toBeInTheDocument()
  }, 12000)

  it('ランキング経由の結果表示ではシェア関連UIを表示しない', async () => {
    // 何を検証するか: ランキング閲覧では共有導線を出さないこと
    vi.spyOn(api.posts, 'get').mockResolvedValue({
      id: 'rank-post-1',
      nickname: 'ランク太郎',
      body: '本文',
      status: 'scored',
      created_at: '2026-02-17T00:00:00Z',
      average_score: 90.1,
      rank: 1,
      total_count: 40,
      judgments: [],
    })

    render(<App />)

    await openRankingResultFromTopRanking()

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: '審査結果モーダル' })).toBeInTheDocument()
    })

    expect(screen.queryByRole('button', { name: 'Xでシェア' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'シェア画像を表示' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('ogp-preview')).not.toBeInTheDocument()
  })

  it('ランキング経由ではトップへではなく戻るボタンを表示し、ランキングモーダルへ戻れる', async () => {
    // 何を検証するか: ランキングから開いた結果モーダルは一覧復帰導線を優先すること
    vi.spyOn(api.posts, 'get').mockResolvedValue({
      id: 'rank-post-1',
      nickname: 'ランク太郎',
      body: '本文',
      status: 'scored',
      created_at: '2026-02-17T00:00:00Z',
      average_score: 90.1,
      rank: 1,
      total_count: 40,
      judgments: [],
    })

    render(<App />)

    await openRankingResultFromTopRanking()

    const resultModal = await screen.findByRole('dialog', { name: '審査結果モーダル' })
    expect(
      within(resultModal).getByRole('button', { name: 'ランキングへ戻る' })
    ).toBeInTheDocument()
    expect(within(resultModal).queryByRole('button', { name: 'トップへ' })).not.toBeInTheDocument()

    fireEvent.click(within(resultModal).getByRole('button', { name: 'ランキングへ戻る' }))

    const rankingDialog = await screen.findByRole('dialog', { name: 'ランキング' })
    expect(rankingDialog).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: '審査結果モーダル' })).not.toBeInTheDocument()
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

    await openRankingResultFromTopRanking()
    fireEvent.click(await screen.findByRole('button', { name: '再試行' }))

    await waitFor(() => {
      expect(screen.getByText('スコア: 77.7')).toBeInTheDocument()
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
      {
        rank: 1,
        id: 'rank-post-1',
        nickname: 'ランク太郎',
        body: '本文',
        average_score: 90.1,
      },
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

    await openRankingResultFromTopRanking()

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: '審査結果モーダル' })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: '再審査する' })).toBeInTheDocument()
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
    await openRankingResultFromTopRanking()

    const rejudgeButton = await screen.findByRole('button', {
      name: '再審査する',
    })
    fireEvent.click(rejudgeButton)

    await waitFor(() => {
      expect(rejudgeSpy).toHaveBeenCalledWith('rejudge-post-id', ['hiroyuki', 'dewi', 'nakao'])
    })
    expect(rejudgeSpy).toHaveBeenCalledTimes(1)
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
    await openRankingResultFromTopRanking()

    const rejudgeButton = await screen.findByRole('button', {
      name: '再審査する',
    })
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
