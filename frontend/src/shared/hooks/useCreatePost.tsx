import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../constants/queryKeys'
import { api } from '../services/api'
import type { CreatePostRequest, CreatePostResponse } from '../types/api'

/**
 * 投稿を作成するカスタムフック
 *
 * 投稿成功時にランキングキャッシュを無効化し、最新データを表示する
 *
 * @returns TanStack Queryのミューテーション結果
 */
export function useCreatePost() {
  const queryClient = useQueryClient()

  return useMutation<CreatePostResponse, Error, CreatePostRequest>({
    mutationFn: (data) => api.posts.create(data),
    onSuccess: () => {
      // ランキングキャッシュを無効化して再取得
      queryClient.invalidateQueries({ queryKey: queryKeys.rankings.all })
    },
  })
}
