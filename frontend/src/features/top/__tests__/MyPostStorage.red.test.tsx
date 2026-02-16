import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../../App'

vi.mock('@tanstack/react-query-devtools', () => ({
  ReactQueryDevtools: () => <div data-testid="react-query-devtools" />,
}))

describe('MyPostStorage RED', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('互換キーからmy_post_idsへ移行して旧キーを削除する', () => {
    // 何を検証するか: 旧LocalStorageキーから新キーへ移行し、データが引き継がれること
    localStorage.setItem('aruaruarena_my_posts', JSON.stringify(['legacy-1', 'legacy-2']))

    render(<App />)

    expect(localStorage.getItem('my_post_ids')).toBe(JSON.stringify(['legacy-1', 'legacy-2']))
    expect(localStorage.getItem('aruaruarena_my_posts')).toBeNull()
  })

  it('不正JSON時でも空状態文言を表示してクラッシュしない', async () => {
    // 何を検証するか: 破損したLocalStorage値でもモーダルを開いて空状態を表示できること
    localStorage.setItem('my_post_ids', '{invalid-json')

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '自分の投稿一覧' }))

    expect(await screen.findByText('投稿するとここに表示されます')).toBeInTheDocument()
  })

  it('21件以上保存されている場合は表示を20件に制限する', async () => {
    // 何を検証するか: 投稿一覧モーダルで表示件数の上限20件が守られること
    const ids = Array.from({ length: 21 }, (_, index) => `id-${index + 1}`)
    localStorage.setItem('my_post_ids', JSON.stringify(ids))

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '自分の投稿一覧' }))

    expect((await screen.findAllByTestId('my-post-id-item')).length).toBe(20)
  })
})
