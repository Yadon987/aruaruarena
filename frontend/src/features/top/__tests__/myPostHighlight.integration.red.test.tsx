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

describe('MyPostHighlight Integration RED', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()

    mockedUseRankings.mockReturnValue({
      data: {
        rankings: [
          { rank: 1, id: 'id-1', nickname: '太郎', body: '本文1', average_score: 95.3 },
          { rank: 2, id: 'id-2', nickname: '次郎', body: '本文2', average_score: 94.2 },
        ],
        total_count: 2,
      },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useRankings>)
  })

  it('クリック/Enter/Spaceで自分の投稿一覧モーダルを開ける', async () => {
    // 何を検証するか: 投稿一覧導線がポインタとキーボード操作の両方で開けること
    render(<App />)

    const trigger = screen.getByRole('button', { name: '自分の投稿一覧' })
    fireEvent.click(trigger)
    expect(await screen.findByRole('dialog', { name: '自分の投稿' })).toBeInTheDocument()

    fireEvent.keyDown(trigger, { key: 'Enter' })
    fireEvent.keyDown(trigger, { key: ' ' })

    expect(screen.getByRole('dialog', { name: '自分の投稿' })).toBeInTheDocument()
  })

  it('同一IDのin-flight中は重複リクエストしない', async () => {
    // 何を検証するか: 同じ投稿IDを連続クリックしても詳細取得APIが1回だけ呼ばれること
    const deferred = new Promise(() => {})
    const getPostSpy = vi.spyOn(api.posts, 'get').mockReturnValue(deferred as never)
    localStorage.setItem('my_post_ids', JSON.stringify(['id-1']))

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '自分の投稿一覧' }))
    const idButton = await screen.findByRole('button', { name: 'id-1' })
    fireEvent.click(idButton)
    fireEvent.click(idButton)

    await waitFor(() => expect(getPostSpy).toHaveBeenCalledTimes(1))
  })
})
