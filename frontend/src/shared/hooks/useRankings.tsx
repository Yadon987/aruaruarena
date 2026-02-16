import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../constants/queryKeys'
import { api } from '../services/api'
import {
  DEFAULT_RANKING_LIMIT,
  MAX_RANKING_LIMIT,
  MIN_RANKING_LIMIT,
  RANKING_POLLING_INTERVAL_MS,
} from '../constants/query'
import type { GetRankingResponse } from '../types/api'

interface UseRankingsOptions {
  polling?: boolean
}

/**
 * limitを安全な範囲に丸める
 */
function normalizeRankingLimit(limit: number): number {
  return Math.min(Math.max(limit, MIN_RANKING_LIMIT), MAX_RANKING_LIMIT)
}

/**
 * ランキングデータを取得するカスタムフック
 *
 * @param limit - 取得件数（デフォルト: 20）
 * @param options - 取得オプション（polling等）
 * @returns TanStack Queryのクエリ結果
 */
export function useRankings(
  limit: number = DEFAULT_RANKING_LIMIT,
  options: UseRankingsOptions = {}
) {
  const normalizedLimit = normalizeRankingLimit(limit)

  return useQuery<GetRankingResponse>({
    queryKey: queryKeys.rankings.list(normalizedLimit),
    queryFn: () => api.rankings.list(normalizedLimit),
    refetchInterval: options.polling ? RANKING_POLLING_INTERVAL_MS : false,
  })
}
