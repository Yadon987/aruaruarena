import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../constants/queryKeys'
import { api } from '../services/api'
import type { CreatePostRequest, CreatePostResponse } from '../types/api'

export function useCreatePost() {
  const queryClient = useQueryClient()

  return useMutation<CreatePostResponse, Error, CreatePostRequest>({
    mutationFn: (data) => api.posts.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rankings.all })
    },
  })
}
