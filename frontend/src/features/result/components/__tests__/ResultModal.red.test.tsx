import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../../../App'
import { useRankings } from '../../../../shared/hooks/useRankings'
import { api, ApiClientError } from '../../../../shared/services/api'

vi.mock('@tanstack/react-query-devtools', () => ({
  ReactQueryDevtools: () => <div data-testid="react-query-devtools" />,
}))
vi.mock('../../../../shared/hooks/useRankings', () => ({
  useRankings: vi.fn(),
}))

const mockedUseRankings = vi.mocked(useRankings)

function setupRanking() {
  mockedUseRankings.mockReturnValue({
    data: {
      rankings: [{ rank: 1, id: 'rank-1', nickname: '太郎', body: '本文', average_score: 91.2 }],
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

  fireEvent.change(screen.getByLabelText('ニックネーム'), { target: { value: '結果太郎' } })
  fireEvent.change(screen.getByLabelText('あるある本文'), { target: { value: '結果表示テスト本文です' } })
  fireEvent.click(screen.getByRole('button', { name: '投稿する' }))

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

  it('judgment.success=false の場合に失敗表示を行う', async () => {
    // 何を検証するか: 審査員ごとの success=false がカードに失敗として表示されること
    await moveToResultScreen({
      status: 'scored',
      average_score: 66.6,
      rank: 10,
      total_count: 30,
      judgments: [
        { persona: 'hiroyuki', total_score: 20, comment: '失敗ケース', success: false },
        { persona: 'dewi', total_score: 60, comment: '成功ケース', success: true },
        { persona: 'nakao', total_score: 80, comment: '成功ケース', success: true },
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
    fireEvent.click(screen.getByRole('button', { name: '自分の投稿一覧' }))
    fireEvent.click(await screen.findByRole('button', { name: 'missing-post-id' }))

    expect(await screen.findByText('投稿が見つかりません')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '再試行' })).toBeInTheDocument()
  })

  it('取得中状態で読み込み中表示を行う', async () => {
    // 何を検証するか: 結果取得中に審査中メッセージを表示すること
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
    fireEvent.change(screen.getByLabelText('ニックネーム'), { target: { value: '読込太郎' } })
    fireEvent.change(screen.getByLabelText('あるある本文'), { target: { value: '読込テスト本文です' } })
    fireEvent.click(screen.getByRole('button', { name: '投稿する' }))

    await waitFor(() => {
      expect(screen.getByText('AI審査員が採点中...')).toBeInTheDocument()
    })
  })
})
