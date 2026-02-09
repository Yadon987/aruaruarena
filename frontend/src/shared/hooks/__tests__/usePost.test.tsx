import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
// @ts-ignore
import { usePost } from '../usePost'
import { api } from '../../services/api'

vi.mock('../../services/api', () => ({
  api: {
    posts: {
      get: vi.fn(),
    },
  },
}))

describe('usePost', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    vi.clearAllMocks()
  })

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  it('usePost が投稿IDで useQuery を呼び出しデータを取得する', async () => {
    // 検証内容: 正常系データ取得
    const mockPost = { id: '123', nickname: 'test', body: 'body' }
    // @ts-ignore
    api.posts.get.mockResolvedValue(mockPost)

    const { result } = renderHook(() => usePost('123'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(mockPost)
    expect(api.posts.get).toHaveBeenCalledWith('123')
  })

  it('空文字IDの場合はfetchStatusがidleになる', async () => {
    // 検証内容: IDが空の場合の挙動（enabled: false）
    // fetchStatus: idle はクエリが実行されていないことを明示的に示す
    const { result } = renderHook(() => usePost(''), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(api.posts.get).not.toHaveBeenCalled()
  })

  it('有効なIDの場合はfetchStatusがfetchingになる', async () => {
    // 検証内容: 通常のデータ取得時の挙動
    const mockPost = { id: '123', nickname: 'test', body: 'body' }
    // @ts-ignore
    api.posts.get.mockResolvedValue(mockPost)

    const { result } = renderHook(() => usePost('123'), { wrapper })

    // 最初はfetching状態
    expect(result.current.fetchStatus).toBe('fetching')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // 完了後はidleに戻る
    expect(result.current.fetchStatus).toBe('idle')
  })
})
