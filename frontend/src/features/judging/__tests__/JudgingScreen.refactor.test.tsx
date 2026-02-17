import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../../App'
import { api } from '../../../shared/services/api'

vi.mock('@tanstack/react-query-devtools', () => ({
  ReactQueryDevtools: () => <div data-testid="react-query-devtools" />,
}))

describe('E13-01 REFACTOR: JudgingScreen edge cases', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  async function submitValidPost() {
    fireEvent.change(screen.getByLabelText('ニックネーム'), { target: { value: '太郎' } })
    fireEvent.change(screen.getByLabelText('あるある本文'), {
      target: { value: 'スヌーズ押して二度寝' },
    })
    fireEvent.click(screen.getByRole('button', { name: '投稿する' }))

    await waitFor(() => {
      expect(api.posts.create).toHaveBeenCalledTimes(1)
    })
  }

  it('投稿詳細取得成功時にフォールバック本文から取得本文へ更新する', async () => {
    vi.spyOn(api.posts, 'create').mockResolvedValue({ id: 'judging-refactor-1', status: 'judging' })
    vi.spyOn(api.posts, 'get').mockResolvedValue({
      id: 'judging-refactor-1',
      nickname: '太郎',
      body: '更新後の本文',
      status: 'judging',
      created_at: '2026-02-16T00:00:00Z',
      judgments: [],
    })

    render(<App />)
    await submitValidPost()

    expect(await screen.findByText('更新後の本文')).toBeInTheDocument()
  })

  it('投稿詳細のnickname/bodyが空文字なら既定フォールバックを維持する', async () => {
    vi.spyOn(api.posts, 'create').mockResolvedValue({ id: 'judging-refactor-2', status: 'judging' })
    vi.spyOn(api.posts, 'get').mockResolvedValue({
      id: 'judging-refactor-2',
      nickname: '',
      body: '',
      status: 'judging',
      created_at: '2026-02-16T00:00:00Z',
      judgments: [],
    })

    render(<App />)
    await submitValidPost()

    expect(await screen.findByText('名無し')).toBeInTheDocument()
    expect(screen.getByText('投稿内容を読み込み中です')).toBeInTheDocument()
  })

  it('投稿詳細取得失敗時も審査中画面の表示を継続する', async () => {
    vi.spyOn(api.posts, 'create').mockResolvedValue({ id: 'judging-refactor-3', status: 'judging' })
    vi.spyOn(api.posts, 'get').mockRejectedValue(new Error('network error'))

    render(<App />)
    await submitValidPost()

    await waitFor(() => {
      expect(api.posts.get).toHaveBeenCalledTimes(1)
    })

    expect(await screen.findByTestId('judging-screen')).toBeInTheDocument()
    expect(screen.getByText('投稿内容を読み込み中です')).toBeInTheDocument()
  })
})
