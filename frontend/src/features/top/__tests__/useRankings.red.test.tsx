import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
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

    vi.useFakeTimers()
    await act(async () => {
      vi.advanceTimersByTime(3100)
    })

    expect(api.rankings.list).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })
})
