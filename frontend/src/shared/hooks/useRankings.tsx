import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../constants/queryKeys'
import { api } from '../services/api'
import type { GetRankingResponse } from '../types/api'

export function useRankings(limit = 20, _options?: { polling?: boolean }) {
  return useQuery<GetRankingResponse>({
    queryKey: queryKeys.rankings.list(limit),
    queryFn: () => api.rankings.list(limit),
  })
}
