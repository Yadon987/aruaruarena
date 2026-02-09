import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../constants/queryKeys'
import { api } from '../services/api'
import type { GetPostResponse } from '../types/api'

export function usePost(id: string) {
  return useQuery<GetPostResponse>({
    queryKey: queryKeys.posts.detail(id),
    queryFn: () => api.posts.get(id),
    enabled: !!id,
  })
}
