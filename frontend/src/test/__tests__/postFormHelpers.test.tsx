import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { api } from '../../shared/services/api'
import {
  fillAndSubmitPostForm,
  fillPostForm,
  openPostDialog,
  submitPostForm,
} from '../helpers/postFormHelpers'

vi.mock('../../shared/services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../shared/services/api')>()
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

describe('postFormHelpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  it('openPostDialogでダイアログを開く', async () => {
    render(<App />)

    const dialog = await openPostDialog()

    expect(dialog).toBeInTheDocument()
  })

  it('fillPostFormでフォームに入力する', async () => {
    render(<App />)

    await openPostDialog()
    fillPostForm({ nickname: 'テスト太郎', body: 'テスト本文です' })

    expect(screen.getByLabelText('ニックネーム')).toHaveValue('テスト太郎')
    expect(screen.getByLabelText('あるある')).toHaveValue('テスト本文です')
  })

  it('submitPostFormで投稿する', async () => {
    vi.mocked(api.posts.create).mockResolvedValue({ id: 'test', status: 'judging' })
    render(<App />)

    await openPostDialog()
    fillPostForm({ nickname: 'テスト太郎', body: 'テスト本文です' })
    await submitPostForm()

    await screen.findByTestId('judging-screen')
    expect(api.posts.create).toHaveBeenCalledTimes(1)
  })

  it('fillAndSubmitPostFormで開く・入力・送信を実行する', async () => {
    vi.mocked(api.posts.create).mockResolvedValue({ id: 'test', status: 'judging' })
    render(<App />)

    await fillAndSubmitPostForm({ nickname: 'テスト太郎', body: 'テスト本文です' })

    await screen.findByTestId('judging-screen')
    expect(api.posts.create).toHaveBeenCalledWith(
      {
      nickname: 'テスト太郎',
      body: 'テスト本文です',
      },
      expect.any(Object)
    )
  })
})
