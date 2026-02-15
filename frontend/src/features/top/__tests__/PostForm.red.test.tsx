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
  })

  it('有効入力で投稿APIを1回呼び、成功時に入力をクリアする', async () => {
    // 何を検証するか: 正常送信時にPOSTが1回実行され、フォームが初期化されること
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
      expect(screen.getByLabelText('ニックネーム')).toHaveValue('')
      expect(screen.getByLabelText('あるある本文')).toHaveValue('')
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
})
