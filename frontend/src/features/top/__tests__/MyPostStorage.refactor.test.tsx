import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../../App'
import { openMyPostsDialog } from '../../../test/appTestHelpers'

vi.mock('@tanstack/react-query-devtools', () => ({
  ReactQueryDevtools: () => <div data-testid="react-query-devtools" />,
}))

describe('MyPostStorage Refactor', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('投稿一覧表示で重複IDを重複描画しない', async () => {
    // 何を検証するか: 保存値に重複があってもモーダル表示は重複なしで描画されること
    localStorage.setItem('my_post_ids', JSON.stringify(['id-1', 'id-2', 'id-1']))

    render(<App />)

    await openMyPostsDialog()

    expect((await screen.findAllByTestId('my-post-id-item')).length).toBe(2)
    expect(screen.getAllByRole('button', { name: 'id-1' })).toHaveLength(1)
  })
})
