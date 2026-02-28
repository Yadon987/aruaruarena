import { fireEvent, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { useRankings } from '../shared/hooks/useRankings'
import type { RankingItem } from '../shared/types/domain'

type RankingsHookResult = ReturnType<typeof useRankings>

export function mockRankings(
  rankings: RankingItem[],
  totalCount: number = rankings.length
) {
  vi.mocked(useRankings).mockReturnValue({
    data: {
      rankings,
      total_count: totalCount,
    },
    isLoading: false,
    isError: false,
    error: null,
  } as RankingsHookResult)
}

export async function openMyPostsDialog() {
  fireEvent.click(screen.getByRole('button', { name: '自分の投稿一覧' }))
  return screen.findByRole('dialog', { name: '自分の投稿' })
}

export async function selectMyPost(postId: string) {
  await openMyPostsDialog()

  const button = await screen.findByRole('button', { name: postId })
  fireEvent.click(button)

  return button
}
