import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRankings } from '../../../../shared/hooks/useRankings'
import { RankingSection } from '../RankingSection'

vi.mock('../../../../shared/hooks/useRankings', () => ({
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

function setupRanking(mockState: {
  data?: { rankings: typeof rankings }
  isLoading?: boolean
  isError?: boolean
  error?: unknown
}) {
  mockedUseRankings.mockReturnValue({
    data: mockState.data,
    isLoading: mockState.isLoading ?? false,
    isError: mockState.isError ?? false,
    error: mockState.error ?? null,
  } as ReturnType<typeof useRankings>)
}

describe('RankingSection RED', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupRanking({ data: { rankings } })
  })

  it('ランキングデータが表示される', () => {
    render(<RankingSection myPostIds={[]} onSelectRankingPost={vi.fn()} />)

    expect(screen.getByRole('region', { name: 'ランキング表示エリア' })).toBeInTheDocument()
    expect(screen.getByText('1位 user-1')).toBeInTheDocument()
    expect(screen.getByText('20位 user-20')).toBeInTheDocument()
  })

  it('ローディング状態を表示する', () => {
    setupRanking({ isLoading: true })
    render(<RankingSection myPostIds={[]} onSelectRankingPost={vi.fn()} />)

    expect(screen.getByText('ランキングを読み込み中です...')).toBeInTheDocument()
  })

  it('エラー状態を表示する', () => {
    setupRanking({ isError: true, error: new Error('fail') })
    render(<RankingSection myPostIds={[]} onSelectRankingPost={vi.fn()} />)

    expect(
      screen.getByText('取得に失敗しました。時間をおいて再度お試しください。')
    ).toBeInTheDocument()
  })

  it('空状態を表示する', () => {
    setupRanking({ data: { rankings: [] } })
    render(<RankingSection myPostIds={[]} onSelectRankingPost={vi.fn()} />)

    expect(screen.getByText('ランキングはまだありません')).toBeInTheDocument()
  })

  it('アイテムクリック時にコールバックを発火する', () => {
    const onSelectRankingPost = vi.fn()
    render(<RankingSection myPostIds={[]} onSelectRankingPost={onSelectRankingPost} />)

    fireEvent.click(screen.getByRole('button', { name: /^1位 user-1/ }))

    expect(onSelectRankingPost).toHaveBeenCalledWith('id-1')
  })

  it('自分の投稿をハイライト表示する', () => {
    render(<RankingSection myPostIds={['id-3']} onSelectRankingPost={vi.fn()} />)

    const myPostItem = screen.getByRole('button', { name: /^3位 user-3/ })
    expect(myPostItem).toHaveClass('bg-yellow-100')
    expect(screen.getByText('あなたの投稿')).toBeInTheDocument()
  })
})
