import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../constants/queryKeys'
import { api } from '../services/api'
import type { GetPostResponse } from '../types/api'

/**
 * 投稿詳細を取得するカスタムフック
 *
 * @param id - 投稿ID（空文字の場合はクエリを実行しない）
 * @returns TanStack Queryのクエリ結果
 */
export function usePost(id: string) {
  return useQuery<GetPostResponse>({
    queryKey: queryKeys.posts.detail(id),
    queryFn: () => api.posts.get(id),
    enabled: !!id, // IDがない場合はクエリを実行しない
  })
}
