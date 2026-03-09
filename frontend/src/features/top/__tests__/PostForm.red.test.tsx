import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../../App'
import { api } from '../../../shared/services/api'
import {
  fillAndSubmitPostForm,
  fillPostForm,
  openPostDialog,
  submitPostForm,
} from '../../../test/helpers'

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
    window.history.replaceState({}, '', '/')
  })

  it('有効入力で投稿APIを1回呼び、成功時に審査中画面へ遷移する', async () => {
    // 何を検証するか: 正常送信時にPOSTが1回実行され、審査中画面へ遷移すること
    vi.mocked(api.posts.create).mockResolvedValue({
      id: 'post-1',
      status: 'judging',
    })
    render(<App />)

    await fillAndSubmitPostForm({ nickname: 'てすと太郎', body: 'あるあるネタです' })

    await waitFor(() => {
      expect(api.posts.create).toHaveBeenCalledTimes(1)
    })
    expect(api.posts.create).toHaveBeenCalledWith(
      {
        nickname: 'てすと太郎',
        body: 'あるあるネタです',
      },
      expect.any(Object)
    )
    await waitFor(() => {
      expect(screen.getByTestId('judging-screen')).toBeInTheDocument()
    })
  })

  it('failed応答時は成功メッセージを表示せず結果モーダルを開く', async () => {
    // 何を検証するか: failed応答では成功文言を出さず結果モーダルへ遷移すること
    vi.mocked(api.posts.create).mockResolvedValue({
      id: 'post-failed-1',
      status: 'failed',
    })
    vi.spyOn(api.posts, 'get').mockResolvedValue({
      id: 'post-failed-1',
      nickname: 'てすと太郎',
      body: 'あるあるネタです',
      status: 'failed',
      created_at: '2026-03-01T00:00:00Z',
      judgments: [],
    })

    render(<App />)

    await fillAndSubmitPostForm({ nickname: 'てすと太郎', body: 'あるあるネタです' })

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: '審査結果モーダル' })).toBeInTheDocument()
    })
    expect(screen.queryByText('投稿を受け付けました')).not.toBeInTheDocument()
  })

  it('ニックネーム未入力時はAPIを呼ばずエラー表示する', async () => {
    // 何を検証するか: 必須入力バリデーションで未入力を拒否すること
    render(<App />)

    await openPostDialog()
    fillPostForm({ nickname: '', body: 'あるあるネタです' })
    await submitPostForm()

    expect(api.posts.create).not.toHaveBeenCalled()
    expect(screen.getByText('ニックネームと本文を正しく入力してください。')).toBeInTheDocument()
  })

  it('本文3文字未満はAPIを呼ばずエラー表示する', async () => {
    // 何を検証するか: 本文の最小文字数3文字制約を満たすこと
    render(<App />)

    await fillAndSubmitPostForm({ nickname: 'てすと太郎', body: '短い' })

    expect(api.posts.create).not.toHaveBeenCalled()
    expect(screen.getByText('ニックネームと本文を正しく入力してください。')).toBeInTheDocument()
  })

  it('trim後に空のニックネームはAPIを呼ばずエラー表示する', async () => {
    // 何を検証するか: 空白のみニックネーム入力時に送信を拒否すること
    render(<App />)

    await fillAndSubmitPostForm({ nickname: '   ', body: 'あるあるネタです' })

    expect(api.posts.create).not.toHaveBeenCalled()
    expect(screen.getByText('ニックネームと本文を正しく入力してください。')).toBeInTheDocument()
  })

  it('trim後に空の本文はAPIを呼ばずエラー表示する', async () => {
    // 何を検証するか: 空白のみ本文入力時に送信を拒否すること
    render(<App />)

    await fillAndSubmitPostForm({ nickname: 'てすと太郎', body: '   ' })

    expect(api.posts.create).not.toHaveBeenCalled()
    expect(screen.getByText('ニックネームと本文を正しく入力してください。')).toBeInTheDocument()
  })

  it('送信中に再クリックしてもAPIを1回しか呼ばない', async () => {
    // 何を検証するか: 送信中の二重送信が防止されること
    let resolveRequest: ((value: { id: string; status: 'judging' }) => void) | undefined
    const pendingRequest = new Promise<{ id: string; status: 'judging' }>((resolve) => {
      resolveRequest = resolve
    })
    vi.mocked(api.posts.create).mockReturnValueOnce(pendingRequest)
    render(<App />)

    await openPostDialog()
    fillPostForm({ nickname: 'てすと太郎', body: '二重送信テストです' })
    const submitButton = screen.getByRole('button', { name: '投稿' })
    fireEvent.click(submitButton)
    fireEvent.click(submitButton)

    expect(api.posts.create).toHaveBeenCalledTimes(1)

    resolveRequest?.({ id: 'post-2', status: 'judging' })
    await waitFor(() => {
      expect(screen.getByTestId('judging-screen')).toBeInTheDocument()
    })
  })
})
