import { render, screen, waitFor } from '@testing-library/react'
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

describe('MyPostHighlight RED', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mockRankings([
      { rank: 1, id: 'id-1', nickname: '太郎', body: '本文1', average_score: 95.3 },
      { rank: 2, id: 'id-2', nickname: '次郎', body: '本文2', average_score: 94.2 },
      { rank: 3, id: 'id-3', nickname: '三郎', body: '本文3', average_score: 93.1 },
    ])
  })

  it('ランキング一致行に「あなたの投稿」ラベルを表示する', async () => {
    // 何を検証するか: my_post_idsに一致したランキング行だけが自分の投稿として表示されること
    localStorage.setItem('my_post_ids', JSON.stringify(['id-1', 'id-3']))

    render(<App />)

    expect(await screen.findAllByText('あなたの投稿')).toHaveLength(2)
  })

  it('投稿IDクリックでGET /api/posts/:idを1回だけ実行する', async () => {
    // 何を検証するか: 投稿一覧から1回クリックしたとき詳細取得APIが1回だけ呼ばれること
    const getPostSpy = vi.spyOn(api.posts, 'get').mockResolvedValue({
      id: 'id-1',
      nickname: '太郎',
      body: '本文1',
      status: 'scored',
      created_at: '2026-02-16T00:00:00Z',
      average_score: 95.3,
      rank: 1,
    })
    localStorage.setItem('my_post_ids', JSON.stringify(['id-1']))

    render(<App />)

    await selectMyPost('id-1')

    await waitFor(() => {
      expect(getPostSpy).toHaveBeenCalledTimes(1)
      expect(getPostSpy).toHaveBeenCalledWith('id-1')
    })
  })

  it('404時に該当IDをLocalStorageから削除する', async () => {
    // 何を検証するか: 取得失敗(404)した投稿IDが保存一覧からクリーンアップされること
    vi.spyOn(api.posts, 'get').mockRejectedValue({ status: 404, code: 'NOT_FOUND' })
    localStorage.setItem('my_post_ids', JSON.stringify(['id-1', 'id-2', 'id-1']))

    render(<App />)

    await selectMyPost('id-1')

    expect(localStorage.getItem('my_post_ids')).toBe(JSON.stringify(['id-2']))
    expect(await screen.findByText('投稿が見つかりません')).toBeInTheDocument()
  })
})
