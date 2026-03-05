import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { queryKeys } from '../../constants/queryKeys'
import { useCreatePost } from '../useCreatePost'

const { mockPostsCreate } = vi.hoisted(() => ({
  mockPostsCreate: vi.fn(),
}))

// api モジュールのモック化
vi.mock('../../services/api', () => ({
  api: {
    posts: {
      create: mockPostsCreate,
    },
  },
}))

describe('useCreatePost', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
      },
    })
    vi.clearAllMocks()
  })

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  it('useCreatePost が useMutation を正しく呼び出し、投稿を作成できる', async () => {
    // 検証内容: 正常系投稿作成
    const mockResponse = { id: 'new-id', status: 'judging' }
    mockPostsCreate.mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useCreatePost(), { wrapper })

    const newPost = { nickname: 'tester', body: 'aruaru' }
    result.current.mutate(newPost)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(mockResponse)
    expect(mockPostsCreate).toHaveBeenCalledWith(newPost)
  })

  it('投稿失敗時に isError が true になる', async () => {
    // 検証内容: 投稿失敗時のエラーハンドリング
    mockPostsCreate.mockRejectedValue(new Error('Failed'))

    const { result } = renderHook(() => useCreatePost(), { wrapper })

    result.current.mutate({ nickname: 'tester', body: 'fail' })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('投稿成功時にランキングキャッシュを無効化する', async () => {
    // 検証内容: キャッシュ無効化戦略
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')

    const mockResponse = { id: 'new-id', status: 'judging' }
    mockPostsCreate.mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useCreatePost(), { wrapper })

    result.current.mutate({ nickname: 'test', body: 'body' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // ランキングキャッシュが無効化されることを確認
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.rankings.all,
    })
  })
})
