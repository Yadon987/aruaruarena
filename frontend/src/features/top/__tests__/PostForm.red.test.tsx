import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import App from '../../../App'
import { api } from '../../../shared/services/api'

vi.mock('../../../shared/services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../shared/services/api')>()
  return {
    ...actual,
    api: {
      ...actual.api,
      posts: {
        ...actual.api.posts,
        create: vi.fn(),
      },
    },
  }
})

describe('E12-01 RED: PostForm バリデーションと投稿', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('有効入力で投稿APIを1回呼び、成功時に審査中画面へ遷移する', async () => {
    // 何を検証するか: 正常送信時にPOSTが1回実行され、審査中画面へ遷移すること
    vi.mocked(api.posts.create).mockResolvedValue({ id: 'post-1', status: 'judging' })
    render(<App />)

    fireEvent.change(screen.getByLabelText('ニックネーム'), { target: { value: 'てすと太郎' } })
    fireEvent.change(screen.getByLabelText('あるある本文'), { target: { value: 'あるあるネタです' } })
    fireEvent.click(screen.getByRole('button', { name: '投稿する' }))

    await waitFor(() => {
      expect(api.posts.create).toHaveBeenCalledTimes(1)
    })
    expect(api.posts.create).toHaveBeenCalledWith({
      nickname: 'てすと太郎',
      body: 'あるあるネタです',
    })
    await waitFor(() => {
      expect(screen.getByTestId('judging-screen')).toBeInTheDocument()
    })
  })

  it('ニックネーム未入力時はAPIを呼ばずエラー表示する', () => {
    // 何を検証するか: 必須入力バリデーションで未入力を拒否すること
    render(<App />)

    fireEvent.change(screen.getByLabelText('あるある本文'), { target: { value: 'あるあるネタです' } })
    fireEvent.click(screen.getByRole('button', { name: '投稿する' }))

    expect(api.posts.create).not.toHaveBeenCalled()
    expect(screen.getByText('ニックネームを入力してください')).toBeInTheDocument()
  })

  it('本文3文字未満はAPIを呼ばずエラー表示する', () => {
    // 何を検証するか: 本文の最小文字数3文字制約を満たすこと
    render(<App />)

    fireEvent.change(screen.getByLabelText('ニックネーム'), { target: { value: 'てすと太郎' } })
    fireEvent.change(screen.getByLabelText('あるある本文'), { target: { value: '短い' } })
    fireEvent.click(screen.getByRole('button', { name: '投稿する' }))

    expect(api.posts.create).not.toHaveBeenCalled()
    expect(screen.getByText('本文は3文字以上で入力してください')).toBeInTheDocument()
  })

  it('trim後に空のニックネームはAPIを呼ばずエラー表示する', () => {
    // 何を検証するか: 空白のみニックネーム入力時に送信を拒否すること
    render(<App />)

    fireEvent.change(screen.getByLabelText('ニックネーム'), { target: { value: '   ' } })
    fireEvent.change(screen.getByLabelText('あるある本文'), { target: { value: 'あるあるネタです' } })
    fireEvent.click(screen.getByRole('button', { name: '投稿する' }))

    expect(api.posts.create).not.toHaveBeenCalled()
    expect(screen.getByText('ニックネームを入力してください')).toBeInTheDocument()
  })

  it('trim後に空の本文はAPIを呼ばずエラー表示する', () => {
    // 何を検証するか: 空白のみ本文入力時に送信を拒否すること
    render(<App />)

    fireEvent.change(screen.getByLabelText('ニックネーム'), { target: { value: 'てすと太郎' } })
    fireEvent.change(screen.getByLabelText('あるある本文'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: '投稿する' }))

    expect(api.posts.create).not.toHaveBeenCalled()
    expect(screen.getByText('本文は3文字以上で入力してください')).toBeInTheDocument()
  })

  it('送信中に再クリックしてもAPIを1回しか呼ばない', async () => {
    // 何を検証するか: 送信中の二重送信が防止されること
    let resolveRequest: ((value: { id: string; status: 'judging' }) => void) | undefined
    const pendingRequest = new Promise<{ id: string; status: 'judging' }>((resolve) => {
      resolveRequest = resolve
    })
    vi.mocked(api.posts.create).mockReturnValueOnce(pendingRequest)
    render(<App />)

    fireEvent.change(screen.getByLabelText('ニックネーム'), { target: { value: 'てすと太郎' } })
    fireEvent.change(screen.getByLabelText('あるある本文'), { target: { value: '二重送信テストです' } })
    fireEvent.click(screen.getByRole('button', { name: '投稿する' }))
    fireEvent.click(screen.getByRole('button', { name: '投稿する' }))

    expect(api.posts.create).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: '投稿する' })).toBeDisabled()

    resolveRequest?.({ id: 'post-2', status: 'judging' })
    await waitFor(() => {
      expect(screen.getByTestId('judging-screen')).toBeInTheDocument()
    })
  })
})
