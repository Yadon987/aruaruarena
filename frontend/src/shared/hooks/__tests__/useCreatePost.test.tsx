import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
// @ts-ignore
import { useCreatePost } from '../useCreatePost'
import { api } from '../../services/api'
// @ts-ignore
import { queryKeys } from '../../constants/queryKeys'

// api モジュールのモック化
vi.mock('../../services/api', () => ({
  api: {
    posts: {
      create: vi.fn(),
    },
  },
}))

// queryKeys のモック化（存在しない場合のエラー回避のため、本来は実装依存だがテストを通すためにモックが必要かも）
// ここでは、useCreatePost内でインポートエラーになることを期待しているが、
// モジュール単位でのテストなので、依存モジュールが存在しないとテスト実行自体ができない可能性がある。
// 一旦このまま進める。

describe('useCreatePost', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient()
    vi.clearAllMocks()
  })

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  it('useCreatePost が useMutation を正しく呼び出し、投稿を作成できる', async () => {
    // 検証内容: 正常系投稿作成
    const mockResponse = { id: 'new-id', status: 'judging' }
    // @ts-ignore
    api.posts.create.mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useCreatePost(), { wrapper })

    const newPost = { nickname: 'tester', body: 'aruaru' }
    result.current.mutate(newPost)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(mockResponse)
    expect(api.posts.create).toHaveBeenCalledWith(newPost)
  })

  it('投稿失敗時に isError が true になる', async () => {
    // 検証内容: 投稿失敗時のエラーハンドリング
    // @ts-ignore
    api.posts.create.mockRejectedValue(new Error('Failed'))

    const { result } = renderHook(() => useCreatePost(), { wrapper })

    result.current.mutate({ nickname: 'tester', body: 'fail' })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
