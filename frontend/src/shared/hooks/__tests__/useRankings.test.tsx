import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
// @ts-ignore
import { useRankings } from '../useRankings'
import { api, ApiClientError } from '../../services/api'

// api モジュールのモック化
vi.mock('../../services/api', () => ({
  api: {
    rankings: {
      list: vi.fn(),
    },
  },
  ApiClientError: class extends Error {
    constructor(public message: string, public code: string, public status: number) {
      super(message)
    }
  },
}))

describe('useRankings', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false, // テストのタイムアウトを防ぐためリトライ無効化
        },
      },
    })
    vi.clearAllMocks()
  })

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  it('useRankings が useQuery を正しく呼び出し、データを返す', async () => {
    // 検証内容: 正常系データ取得
    const mockData = { rankings: [{ id: '1', nickname: 'test' }], total_count: 1 }
    // @ts-ignore
    api.rankings.list.mockResolvedValue(mockData)

    const { result } = renderHook(() => useRankings(10), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(mockData)
    expect(api.rankings.list).toHaveBeenCalledWith(10)
  })

  it('API エラー時に isError が true になる', async () => {
    // 検証内容: エラーハンドリング
    const error = new ApiClientError('Error', 'ERROR_CODE', 500)
    // @ts-ignore
    api.rankings.list.mockRejectedValue(error)

    const { result } = renderHook(() => useRankings(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBeInstanceOf(ApiClientError)
  })

  // その他の細かい境界値テストやリトライロジックのテストは
  // QueryClientの設定に依存するため、ここでは基本的な挙動を確認する

  it('limitパラメータがAPI呼び出しに正しく渡される', async () => {
    // 検証内容: limitパラメータの伝達
    const mockData = { rankings: [], total_count: 0 }
    // @ts-ignore
    api.rankings.list.mockResolvedValue(mockData)

    const limit = 15
    const { result } = renderHook(() => useRankings(limit), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(api.rankings.list).toHaveBeenCalledWith(limit)
  })

  it('異なるlimitでクエリキーが変わる', async () => {
    // 検証内容: limitによるクエリキーの変化（キャッシュ分離）
    const mockData = { rankings: [], total_count: 0 }
    // @ts-ignore
    api.rankings.list.mockResolvedValue(mockData)

    const { result: result1 } = renderHook(() => useRankings(10), { wrapper })
    const { result: result2 } = renderHook(() => useRankings(20), { wrapper })

    await waitFor(() => expect(result1.current.isSuccess).toBe(true))
    await waitFor(() => expect(result2.current.isSuccess).toBe(true))

    // 異なるlimitは異なるクエリキーになる
    // (実際の実装ではqueryKeys.rankings.list(limit)が使われる)
    expect(api.rankings.list).toHaveBeenCalledWith(10)
    expect(api.rankings.list).toHaveBeenCalledWith(20)
  })
})
