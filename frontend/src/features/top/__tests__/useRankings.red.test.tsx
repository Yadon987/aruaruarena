import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
// @ts-ignore
import { api } from '../../../shared/services/api'
import { useRankings } from '../../../shared/hooks/useRankings'

vi.mock('../../../shared/services/api', () => ({
  api: {
    rankings: {
      list: vi.fn(),
    },
  },
}))

describe('useRankings RED', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })
    vi.clearAllMocks()
  })

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  it('polling=trueのとき3秒ごとに再取得される', async () => {
    // 何を検証するか: 3秒ポーリングでランキング再取得が継続されること
    // @ts-ignore
    api.rankings.list.mockResolvedValue({ rankings: [], total_count: 0 })

    renderHook(() => useRankings(20, { polling: true }), { wrapper })

    await waitFor(() => expect(api.rankings.list).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(api.rankings.list).toHaveBeenCalledTimes(2), { timeout: 4000 })
  })

  it('polling=falseのとき定期再取得しない', async () => {
    // 何を検証するか: polling無効時は3秒経過しても再取得されないこと
    // @ts-ignore
    api.rankings.list.mockResolvedValue({ rankings: [], total_count: 0 })

    renderHook(() => useRankings(20, { polling: false }), { wrapper })

    await waitFor(() => expect(api.rankings.list).toHaveBeenCalledTimes(1))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 3200))
    })

    expect(api.rankings.list).toHaveBeenCalledTimes(1)
  })

  it('limitが範囲外でも1〜20に丸めてAPIを呼ぶ', async () => {
    // 何を検証するか: 件数パラメータが安全な範囲に正規化されること
    // @ts-ignore
    api.rankings.list.mockResolvedValue({ rankings: [], total_count: 0 })

    renderHook(() => useRankings(0), { wrapper })
    renderHook(() => useRankings(99), { wrapper })

    await waitFor(() => expect(api.rankings.list).toHaveBeenCalled())
    expect(api.rankings.list).toHaveBeenCalledWith(1)
    expect(api.rankings.list).toHaveBeenCalledWith(20)
  })
})
