import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../constants/queryKeys'
import { api } from '../services/api'
import { DEFAULT_RANKING_LIMIT } from '../constants/query'
import type { GetRankingResponse } from '../types/api'

/**
 * ランキングデータを取得するカスタムフック
 *
 * @param limit - 取得件数（デフォルト: 20）
 * @param _options - 将来の拡張用オプション（polling等）
 * @returns TanStack Queryのクエリ結果
 */
export function useRankings(limit: number = DEFAULT_RANKING_LIMIT, _options?: { polling?: boolean }) {
  return useQuery<GetRankingResponse>({
    queryKey: queryKeys.rankings.list(limit),
    queryFn: () => api.rankings.list(limit),
  })
}
