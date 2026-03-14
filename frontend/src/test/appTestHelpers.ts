import { act, fireEvent, screen, within } from '@testing-library/react'
import { vi } from 'vitest'
import { useRankings } from '../shared/hooks/useRankings'
import type { RankingItem } from '../shared/types/domain'

type RankingsHookResult = ReturnType<typeof useRankings>

export function mockRankings(rankings: RankingItem[], totalCount: number = rankings.length) {
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
  await act(async () => {
    fireEvent.click(await screen.findByRole('button', { name: 'その他を開く' }))
    fireEvent.click(await screen.findByRole('button', { name: '過去の投稿' }))
  })
  return screen.findByRole('dialog', { name: '自分の投稿' })
}

export async function selectMyPost(postId: string) {
  const dialog = await openMyPostsDialog()

  const postIdNode = await within(dialog).findByText(postId)
  const button = postIdNode.closest('button')
  if (!button) {
    throw new Error(`投稿ID ${postId} の投稿カードボタンが見つかりません`)
  }
  await act(async () => {
    fireEvent.click(button)
    await Promise.resolve()
  })

  return button
}
