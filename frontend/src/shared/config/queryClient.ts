import { QueryClient } from '@tanstack/react-query'
import { ApiClientError } from '../services/api'
import { QUERY_CONFIG } from '../constants/query'

/**
 * TanStack Queryのクライアント設定
 *
 * リトライ戦略:
 * - ネットワークエラー時のみ1回リトライ
 * - バリデーションエラー/レート制限時はリトライしない
 * - ウィンドウフォーカス時の再取得は無効（ポーリングで管理）
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: QUERY_CONFIG.STALE_TIME,
      gcTime: QUERY_CONFIG.GC_TIME,
      retry: (failureCount, error) => {
        // バリデーションエラーやレート制限はリトライしない
        if (error instanceof ApiClientError) {
          if (error.code === 'VALIDATION_ERROR' || error.code === 'RATE_LIMITED') {
            return false
          }
        }
        // ネットワークエラーのみ1回リトライ
        return failureCount < QUERY_CONFIG.MAX_RETRY_COUNT
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})
