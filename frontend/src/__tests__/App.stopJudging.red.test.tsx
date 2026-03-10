import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { api } from '../shared/services/api'
import { fillPostForm, openPostDialog, submitPostForm } from '../test/helpers'

describe('E30-01 RED: 審査停止導線', () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.replaceState({}, '', '/')
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('審査中のみ停止ボタンを表示し、確認ダイアログを開ける', async () => {
    // 何を検証するか: 審査中画面でのみ停止導線が出て、誤操作防止ダイアログを表示できること
    vi.spyOn(api.posts, 'create').mockImplementation(() => new Promise(() => {}))
    vi.spyOn(api.posts, 'get').mockImplementation(() => new Promise(() => {}))

    render(<App />)
    expect(
      screen.queryByRole('button', { name: '審査を停止してホームに戻る' })
    ).not.toBeInTheDocument()

    await openPostDialog()
    fillPostForm({ nickname: '停止太郎', body: '審査停止導線の表示確認' })
    await submitPostForm()

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '投稿する' })).not.toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '審査を停止してホームに戻る' }))
    expect(screen.getByRole('dialog', { name: '審査停止確認' })).toBeInTheDocument()
  })

  it('審査停止でトップへ戻り、投稿フォーム入力が初期化される', async () => {
    // 何を検証するか: 停止確定時にトップ遷移し、投稿入力の一時状態が破棄されること
    vi.spyOn(api.posts, 'create').mockImplementation(() => new Promise(() => {}))
    vi.spyOn(api.posts, 'get').mockImplementation(() => new Promise(() => {}))

    render(<App />)
    await openPostDialog()
    fillPostForm({ nickname: '初期化太郎', body: '停止時に初期化される入力' })
    await submitPostForm()

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '投稿する' })).not.toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '審査を停止してホームに戻る' }))
    fireEvent.click(screen.getByRole('button', { name: '中止する' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '投稿する' })).toBeInTheDocument()
      expect(window.location.pathname).toBe('/')
    })

    await openPostDialog()
    expect(screen.getByLabelText('ニックネーム')).toHaveValue('')
    expect(screen.getByLabelText('あるある')).toHaveValue('')
  })

  it('停止後に投稿作成成功レスポンスが返っても審査画面へ戻らない', async () => {
    // 何を検証するか: 停止後の遅延成功応答を無効化し、画面巻き戻りを防げること
    let resolveCreate: (value: { id: string; status: 'judging' }) => void = () => {}
    const createPromise = new Promise<{ id: string; status: 'judging' }>((resolve) => {
      resolveCreate = resolve
    })
    vi.spyOn(api.posts, 'create').mockReturnValue(createPromise)
    vi.spyOn(api.posts, 'get').mockImplementation(() => new Promise(() => {}))

    render(<App />)
    await openPostDialog()
    fillPostForm({ nickname: '遅延太郎', body: '遅延レスポンス無効化' })
    await submitPostForm()

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '投稿する' })).not.toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '審査を停止してホームに戻る' }))
    fireEvent.click(screen.getByRole('button', { name: '中止する' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '投稿する' })).toBeInTheDocument()
      expect(window.location.pathname).toBe('/')
    })

    resolveCreate({ id: 'delayed-official-id', status: 'judging' })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '投稿する' })).toBeInTheDocument()
      expect(window.location.pathname).toBe('/')
    })
  })
})
