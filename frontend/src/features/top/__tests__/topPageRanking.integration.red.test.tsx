import { render, screen } from '@testing-library/react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import App from '../../../App'
import { ApiClientError } from '../../../shared/services/api'
import { useRankings } from '../../../shared/hooks/useRankings'

vi.mock('@tanstack/react-query-devtools', () => ({
  ReactQueryDevtools: () => <div data-testid="react-query-devtools" />,
}))
vi.mock('../../../shared/hooks/useRankings', () => ({
  useRankings: vi.fn(),
}))

const mockedUseRankings = vi.mocked(useRankings)
const rankings = Array.from({ length: 20 }, (_, i) => ({
  rank: i + 1,
  id: `id-${i + 1}`,
  nickname: `user-${i + 1}`,
  body: `body-${i + 1}`,
  average_score: 90 - i * 0.1,
}))

describe('TopPage Ranking Integration RED', () => {
  beforeEach(() => {
    mockedUseRankings.mockReturnValue({
      data: { rankings, total_count: 20 },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useRankings>)
  })

  it('初回表示でローディング後にランキング一覧が表示される', async () => {
    // 何を検証するか: 初回取得でloadingからランキング表示へ遷移すること
    render(<App />)

    expect(await screen.findByRole('region', { name: 'ランキング表示エリア' })).toBeInTheDocument()
    expect(await screen.findAllByTestId('ranking-item')).toHaveLength(20)
  })

  it('429エラー時に専用メッセージを表示する', async () => {
    // 何を検証するか: レート制限時に専用エラーメッセージを表示すること
    mockedUseRankings.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new ApiClientError('rate limited', 'RATE_LIMITED', 429),
    } as unknown as ReturnType<typeof useRankings>)
    render(<App />)

    expect(
      await screen.findByText('アクセスが集中しています。しばらく待ってから再度お試しください。')
    ).toBeInTheDocument()
  })

  it('500エラー時に汎用メッセージを表示する', async () => {
    // 何を検証するか: サーバーエラー時に汎用メッセージが表示されること
    mockedUseRankings.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new ApiClientError('server error', 'HTTP_ERROR', 500),
    } as unknown as ReturnType<typeof useRankings>)
    render(<App />)

    expect(
      await screen.findByText('取得に失敗しました。時間をおいて再度お試しください。', {}, { timeout: 5000 })
    ).toBeInTheDocument()
  })

  it('ネットワークエラー時に通信エラーメッセージを表示する', async () => {
    // 何を検証するか: ネットワークエラー時に通信状況の文言を表示すること
    mockedUseRankings.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new ApiClientError('network error', 'NETWORK_ERROR', 0),
    } as unknown as ReturnType<typeof useRankings>)
    render(<App />)

    expect(
      await screen.findByText('通信状況を確認して再度お試しください。', {}, { timeout: 5000 })
    ).toBeInTheDocument()
  })

  it('ランキングが空配列のとき空状態を表示する', async () => {
    // 何を検証するか: データ0件時に空状態文言を表示すること
    mockedUseRankings.mockReturnValue({
      data: { rankings: [], total_count: 0 },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useRankings>)
    render(<App />)

    expect(await screen.findByText('ランキングはまだありません')).toBeInTheDocument()
  })

  it('ランキングが21件以上でも表示は20件に制限される', async () => {
    // 何を検証するか: 表示件数の上限が20件であること
    mockedUseRankings.mockReturnValue({
      data: {
        rankings: Array.from({ length: 25 }, (_, i) => ({
          rank: i + 1,
          id: `id-${i + 1}`,
          nickname: `user-${i + 1}`,
          body: `body-${i + 1}`,
          average_score: 90 - i * 0.1,
        })),
        total_count: 25,
      },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useRankings>)
    render(<App />)

    expect(await screen.findAllByTestId('ranking-item')).toHaveLength(20)
  })
})
