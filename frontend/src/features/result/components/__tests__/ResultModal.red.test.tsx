import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../../../App'
import { useRankings } from '../../../../shared/hooks/useRankings'
import { ApiClientError, api } from '../../../../shared/services/api'
import type { Post } from '../../../../shared/types/domain'
import { fillAndSubmitPostForm } from '../../../../test/helpers'
import { ResultModal } from '../ResultModal'

vi.mock('@tanstack/react-query-devtools', () => ({
  ReactQueryDevtools: () => <div data-testid="react-query-devtools" />,
}))
vi.mock('../../../../shared/hooks/useRankings', () => ({
  useRankings: vi.fn(),
}))

const mockedUseRankings = vi.mocked(useRankings)

function buildModalPost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'modal-post-id',
    nickname: '検証太郎',
    body: '検証本文',
    status: 'scored',
    created_at: '2026-03-02T00:00:00Z',
    average_score: 91.2,
    rank: 1,
    total_count: 10,
    judgments: [],
    ...overrides,
  }
}

function setupRanking() {
  mockedUseRankings.mockReturnValue({
    data: {
      rankings: [
        {
          rank: 1,
          id: 'rank-1',
          nickname: '太郎',
          body: '本文',
          average_score: 91.2,
        },
      ],
      total_count: 1,
    },
    isLoading: false,
    isError: false,
    error: null,
  } as ReturnType<typeof useRankings>)
}

async function moveToResultScreen(postResponse: {
  status: 'scored' | 'failed'
  average_score?: number
  rank?: number
  total_count?: number
  judgments?: Array<{
    persona: 'hiroyuki' | 'dewi' | 'nakao'
    total_score: number
    comment: string
    success?: boolean
  }>
}) {
  vi.spyOn(api.posts, 'create').mockResolvedValue({
    id: 'result-post-id',
    status: 'judging',
  })
  vi.spyOn(api.posts, 'get').mockResolvedValue({
    id: 'result-post-id',
    nickname: '結果太郎',
    body: '結果本文',
    created_at: '2026-02-17T00:00:00Z',
    ...postResponse,
    judgments: postResponse.judgments?.map((item) => ({
      persona: item.persona,
      total_score: item.total_score,
      empathy: 20,
      humor: 20,
      brevity: 20,
      originality: 20,
      expression: 20,
      comment: item.comment,
      success: item.success ?? true,
    })),
  })

  render(<App />)

  await fillAndSubmitPostForm({ nickname: '結果太郎', body: '結果表示テスト本文です' })

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: '審査結果' })).toBeInTheDocument()
  })
}

describe('E15-01 RED: ResultModal Component', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    setupRanking()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('scored時に平均点と順位情報をモーダルに表示する', async () => {
    // 何を検証するか: scored時に平均点を小数1桁表示し、n位 / total_count件中を表示すること
    await moveToResultScreen({
      status: 'scored',
      average_score: 87.65,
      rank: 2,
      total_count: 10,
    })

    expect(screen.getByRole('dialog', { name: '審査結果モーダル' })).toBeInTheDocument()
    expect(screen.getByText('平均点: 87.7')).toBeInTheDocument()
    expect(screen.getByText('2位 / 10件中')).toBeInTheDocument()
  })

  it('scoredで順位情報欠損時に専用メッセージを表示する', async () => {
    // 何を検証するか: scored時にrankまたはtotal_count欠損なら順位情報を取得できませんでしたを表示すること
    await moveToResultScreen({
      status: 'scored',
      average_score: 92.1,
    })

    expect(screen.getByText('順位情報を取得できませんでした')).toBeInTheDocument()
  })

  it('failed時に順位を---表示し平均点未設定なら非表示にする', async () => {
    // 何を検証するか: failed時に順位を---表示し、平均点が無い場合は平均点を表示しないこと
    await moveToResultScreen({
      status: 'failed',
    })

    expect(screen.getByText('順位: ---')).toBeInTheDocument()
    expect(screen.queryByText(/平均点:/)).not.toBeInTheDocument()
  })

  it('judgmentsが3件なら3件すべての審査員カードを表示する', async () => {
    // 何を検証するか: judgmentsが3件ある場合に3件すべて表示すること
    await moveToResultScreen({
      status: 'scored',
      average_score: 85.5,
      rank: 1,
      total_count: 5,
      judgments: [
        { persona: 'hiroyuki', total_score: 90, comment: 'コメント1' },
        { persona: 'dewi', total_score: 82, comment: 'コメント2' },
        { persona: 'nakao', total_score: 84, comment: 'コメント3' },
      ],
    })

    expect(screen.getAllByTestId('judge-result-card')).toHaveLength(3)
  })

  it('average_score が 0 の場合でも 0.0 と表示する', async () => {
    // 何を検証するか: average_score=0 を falsy 扱いせず平均点として表示すること
    await moveToResultScreen({
      status: 'scored',
      average_score: 0,
      rank: 9,
      total_count: 30,
      judgments: [],
    })

    expect(screen.getByText('平均点: 0.0')).toBeInTheDocument()
  })

  it('モーダル内クリックでは閉じない', () => {
    // 何を検証するか: 背景クリック閉鎖時でも結果ダイアログ本体クリックで誤クローズしないこと
    const onClose = vi.fn()
    render(
      <ResultModal
        isOpen
        post={buildModalPost()}
        isLoading={false}
        errorCode={null}
        onRetry={() => undefined}
        onPlayRetrySound={() => undefined}
        onRejudgeSuccess={() => undefined}
        onClose={onClose}
      />
    )

    fireEvent.click(screen.getByRole('dialog', { name: '審査結果モーダル' }))

    expect(onClose).not.toHaveBeenCalled()
  })

  it('モーダル外側クリックで閉じる', () => {
    // 何を検証するか: 結果モーダルは最外層クリックで閉じる統一仕様を満たすこと
    const onClose = vi.fn()
    render(
      <ResultModal
        isOpen
        post={buildModalPost()}
        isLoading={false}
        errorCode={null}
        onRetry={() => undefined}
        onPlayRetrySound={() => undefined}
        onRejudgeSuccess={() => undefined}
        onClose={onClose}
      />
    )

    fireEvent.click(screen.getByTestId('result-modal-overlay'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('judgment.success=false の場合に失敗表示を行う', async () => {
    // 何を検証するか: 審査員ごとの success=false がカードに失敗として表示されること
    await moveToResultScreen({
      status: 'scored',
      average_score: 66.6,
      rank: 10,
      total_count: 30,
      judgments: [
        {
          persona: 'hiroyuki',
          total_score: 20,
          comment: '失敗ケース',
          success: false,
        },
        {
          persona: 'dewi',
          total_score: 60,
          comment: '成功ケース',
          success: true,
        },
        {
          persona: 'nakao',
          total_score: 80,
          comment: '成功ケース',
          success: true,
        },
      ],
    })

    expect(screen.getByText('失敗')).toBeInTheDocument()
  })

  it('judgmentsが空または欠損時に未取得メッセージを表示する', async () => {
    // 何を検証するか: judgmentsが欠損または空配列でも審査結果はまだありませんを表示すること
    await moveToResultScreen({
      status: 'scored',
      average_score: 80,
      rank: 5,
      total_count: 20,
      judgments: [],
    })

    expect(screen.getByText('審査結果はまだありません')).toBeInTheDocument()
  })

  it('NOT_FOUNDとその他エラーで文言と再試行導線を出し分ける', async () => {
    // 何を検証するか: NOT_FOUNDは投稿が見つかりません、その他は汎用文言と再試行ボタンを表示すること
    localStorage.setItem('my_post_ids', JSON.stringify(['missing-post-id']))
    vi.spyOn(api.posts, 'get').mockRejectedValueOnce(
      new ApiClientError('投稿が見つかりません', 'NOT_FOUND', 404)
    )

    render(<App />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '過去の投稿' }))
    })
    const missingPostButton = await screen.findByRole('button', { name: 'missing-post-id' })
    await act(async () => {
      fireEvent.click(missingPostButton)
    })

    expect(await screen.findByText('投稿が見つかりません')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '再試行' })).toBeInTheDocument()
  })

  it('取得中状態で読み込み中表示を行う', async () => {
    // 何を検証するか: 結果取得中は審査中画面を維持し、結果モーダルを表示しないこと
    vi.spyOn(api.posts, 'create').mockResolvedValue({
      id: 'loading-post-id',
      status: 'judging',
    })
    vi.spyOn(api.posts, 'get').mockImplementation(
      () =>
        new Promise(() => {
          return undefined
        })
    )

    render(<App />)
    await fillAndSubmitPostForm({ nickname: '読込太郎', body: '読込テスト本文です' })

    await waitFor(() => {
      expect(screen.getByTestId('judging-screen')).toBeInTheDocument()
    })
    expect(screen.queryByRole('dialog', { name: '審査結果モーダル' })).not.toBeInTheDocument()
  })

  it('共有画像が未準備のままならリトライ失敗メッセージを表示する', { timeout: 15000 }, async () => {
    // 何を検証するか: OGP画像確認が3回失敗した場合に共有を中断し、再試行メッセージを表示すること
    const fetchSpy = vi.fn().mockResolvedValue({ ok: false } as Response)
    vi.stubGlobal('fetch', fetchSpy)
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    await moveToResultScreen({
      status: 'scored',
      average_score: 95.1,
      rank: 1,
      total_count: 50,
      judgments: [],
    })

    const shareButton = await screen.findByRole('button', {
      name: 'Xでシェア',
    })
    await waitFor(() => {
      expect(shareButton).not.toBeDisabled()
    })

    vi.useFakeTimers()
    await act(async () => {
      fireEvent.click(shareButton)
    })

    await act(async () => {
      await vi.advanceTimersToNextTimerAsync()
    })
    expect(screen.getByText('共有前に画像を確認しています...')).toBeInTheDocument()

    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(screen.getByText('画像の準備が終わってから、もう一度お試しください')).toBeInTheDocument()
    expect(shareButton).not.toBeDisabled()

    expect(fetchSpy).toHaveBeenCalledTimes(3)
    expect(openSpy).not.toHaveBeenCalled()
    expect(screen.queryByTestId('ogp-preview')).not.toBeInTheDocument()
  })

  it(
    'OGP画像確認成功時にシェアウィンドウを開きプレビューを表示する',
    { timeout: 15000 },
    async () => {
      // 何を検証するか: OGP画像確認が成功した場合にXのシェアウィンドウを開き、OGPプレビューを表示すること
      const fetchSpy = vi.fn().mockResolvedValue({ ok: true } as Response)
      vi.stubGlobal('fetch', fetchSpy)
      const openSpy = vi.spyOn(window, 'open').mockImplementation(
        () =>
          ({
            focus: vi.fn(),
            close: vi.fn(),
            closed: false,
          }) as unknown as Window
      )

      await moveToResultScreen({
        status: 'scored',
        average_score: 92.5,
        rank: 5,
        total_count: 30,
        judgments: [],
      })

      const shareButton = await screen.findByRole('button', {
        name: 'Xでシェア',
      })
      await waitFor(() => {
        expect(shareButton).not.toBeDisabled()
      })

      vi.useFakeTimers()
      await act(async () => {
        fireEvent.click(shareButton)
      })

      // フェイクタイマーを使用しているため、タイマーを進めてから状態を確認
      // fetchが即座に成功する場合、「確認中」メッセージを経由せず直接完了状態になる
      await act(async () => {
        await vi.runAllTimersAsync()
      })

      // OGP画像確認のHEADリクエストが1回だけ呼ばれること
      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/ogp/posts/result-post-id.png'),
        expect.objectContaining({ method: 'HEAD', cache: 'no-store' })
      )

      // シェアウィンドウが開かれること
      expect(openSpy).toHaveBeenCalledWith(
        expect.stringContaining('https://x.com/intent/tweet'),
        '_blank',
        'noopener,noreferrer'
      )

      // OGPプレビューが表示されること
      const ogpPreview = screen.getByTestId('ogp-preview')
      expect(ogpPreview).toBeInTheDocument()
      expect(ogpPreview).toHaveTextContent('結果本文')

      // エラーメッセージが表示されないこと
      expect(
        screen.queryByText('画像の準備が終わってから、もう一度お試しください')
      ).not.toBeInTheDocument()
    }
  )

  it('同一投稿の再レンダーでは共有準備タイマーを延長しない', async () => {
    // 何を検証するか: post の参照だけ変わっても同じ id と created_at なら既存タイマーを維持すること
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-02T00:00:00Z'))

    const post = buildModalPost()
    const { rerender } = render(
      <ResultModal
        isOpen
        post={post}
        isLoading={false}
        errorCode={null}
        onRetry={() => undefined}
        onPlayRetrySound={() => undefined}
        onRejudgeSuccess={() => undefined}
        onClose={() => undefined}
      />
    )

    const shareButton = screen.getByRole('button', { name: 'Xでシェア' })
    expect(shareButton).toBeDisabled()
    expect(screen.getByText('画像を準備しています。数秒お待ちください')).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    rerender(
      <ResultModal
        isOpen
        post={{ ...post }}
        isLoading={false}
        errorCode={null}
        onRetry={() => undefined}
        onPlayRetrySound={() => undefined}
        onRejudgeSuccess={() => undefined}
        onClose={() => undefined}
      />
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })

    expect(shareButton).not.toBeDisabled()
    expect(screen.queryByText('画像を準備しています。数秒お待ちください')).not.toBeInTheDocument()
  })

  it('即時共有可能になったら準備メッセージを消し、live region として通知する', () => {
    // 何を検証するか: delayMs=0 では準備メッセージが残らず、表示中メッセージは支援技術に通知されること
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-02T00:00:00Z'))

    const { rerender } = render(
      <ResultModal
        isOpen
        post={buildModalPost()}
        isLoading={false}
        errorCode={null}
        onRetry={() => undefined}
        onPlayRetrySound={() => undefined}
        onRejudgeSuccess={() => undefined}
        onClose={() => undefined}
      />
    )

    const statusMessage = screen.getByRole('status')
    expect(statusMessage).toHaveAttribute('aria-live', 'polite')
    expect(statusMessage).toHaveAttribute('aria-atomic', 'true')
    expect(statusMessage).toHaveTextContent('画像を準備しています。数秒お待ちください')

    rerender(
      <ResultModal
        isOpen
        post={buildModalPost({ created_at: '2026-03-01T23:59:50Z' })}
        isLoading={false}
        errorCode={null}
        onRetry={() => undefined}
        onPlayRetrySound={() => undefined}
        onRejudgeSuccess={() => undefined}
        onClose={() => undefined}
      />
    )

    expect(screen.getByRole('button', { name: 'Xでシェア' })).not.toBeDisabled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByText('画像を準備しています。数秒お待ちください')).not.toBeInTheDocument()
  })

  it('再審査ボタン押下でonPlayRetrySoundを呼び出す', async () => {
    // 何を検証するか: 再審査開始時にSE再生コールバックが先に呼ばれること
    const onPlayRetrySound = vi.fn()
    vi.spyOn(api.posts, 'rejudge').mockResolvedValue({
      id: 'failed-post-id',
      status: 'judging',
    })

    render(
      <ResultModal
        isOpen
        post={buildModalPost({
          id: 'failed-post-id',
          status: 'failed',
          judgments: [
            {
              persona: 'hiroyuki',
              total_score: 20,
              empathy: 4,
              humor: 4,
              brevity: 4,
              originality: 4,
              expression: 4,
              comment: '失敗',
              success: false,
            },
          ],
        })}
        isLoading={false}
        errorCode={null}
        onRetry={() => undefined}
        onPlayRetrySound={onPlayRetrySound}
        onRejudgeSuccess={() => undefined}
        onClose={() => undefined}
      />
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '再審査する' }))
    })

    await waitFor(() => {
      expect(onPlayRetrySound).toHaveBeenCalledTimes(1)
    })
  })

  it('再審査SE再生で例外が出ても再審査API呼び出しは継続する', async () => {
    // 何を検証するか: SE再生失敗を握りつぶしても再審査本処理は止めないこと
    const rejudgeSpy = vi.spyOn(api.posts, 'rejudge').mockResolvedValue({
      id: 'failed-post-id',
      status: 'judging',
    })

    render(
      <ResultModal
        isOpen
        post={buildModalPost({
          id: 'failed-post-id',
          status: 'failed',
          judgments: [
            {
              persona: 'hiroyuki',
              total_score: 20,
              empathy: 4,
              humor: 4,
              brevity: 4,
              originality: 4,
              expression: 4,
              comment: '失敗',
              success: false,
            },
          ],
        })}
        isLoading={false}
        errorCode={null}
        onRetry={() => undefined}
        onPlayRetrySound={() => {
          throw new Error('se failed')
        }}
        onRejudgeSuccess={() => undefined}
        onClose={() => undefined}
      />
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '再審査する' }))
    })

    await waitFor(() => {
      expect(rejudgeSpy).toHaveBeenCalledTimes(1)
    })
  })
})
