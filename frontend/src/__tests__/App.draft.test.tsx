import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { api } from '../shared/services/api'
import { fillPostForm, openPostDialog, submitPostForm } from '../test/helpers'

describe('E30-02 RED: 下書き保持と審査停止3アクション', () => {
  const consoleErrorOriginal = console.error
  const setupPendingPostApiMocks = () => {
    vi.spyOn(api.posts, 'create').mockImplementation(() => new Promise(() => {}))
    vi.spyOn(api.posts, 'get').mockImplementation(() => new Promise(() => {}))
  }

  beforeEach(() => {
    localStorage.clear()
    window.history.replaceState({}, '', '/')
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation((message, ...args) => {
      if (typeof message === 'string' && message.includes('Warning:')) return
      consoleErrorOriginal(message, ...args)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('初回投稿モーダルで入力後に閉じても再オープン時に値が残る', async () => {
    render(<App />)

    await openPostDialog()
    fillPostForm({ nickname: '下書き太郎', body: '誤タップでも消したくない本文' })
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '投稿フォーム' })).not.toBeInTheDocument()
    })

    await openPostDialog()
    expect(screen.getByLabelText('ニックネーム')).toHaveValue('下書き太郎')
    expect(screen.getByLabelText('あるある')).toHaveValue('誤タップでも消したくない本文')
  })

  it('審査停止確認で「再投稿する」を押すと下書き保持でモーダルへ戻る', async () => {
    setupPendingPostApiMocks()

    render(<App />)
    await openPostDialog()
    fillPostForm({ nickname: '再投稿太郎', body: '再投稿で復元される本文' })
    await submitPostForm()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '審査を停止してホームに戻る' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '審査を停止してホームに戻る' }))
    fireEvent.click(screen.getByRole('button', { name: '再投稿する' }))

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: '投稿フォーム' })).toBeInTheDocument()
    })
    expect(window.location.pathname).toBe('/')
    expect(screen.getByLabelText('ニックネーム')).toHaveValue('再投稿太郎')
    expect(screen.getByLabelText('あるある')).toHaveValue('再投稿で復元される本文')
  })

  it('審査停止確認で「中止する」を押すと下書きを破棄してトップへ戻る', async () => {
    setupPendingPostApiMocks()

    render(<App />)
    await openPostDialog()
    fillPostForm({ nickname: '破棄太郎', body: '中止で破棄される本文' })
    await submitPostForm()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '審査を停止してホームに戻る' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '審査を停止してホームに戻る' }))
    fireEvent.click(screen.getByRole('button', { name: '中止する' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '投稿する' })).toBeInTheDocument()
    })
    expect(window.location.pathname).toBe('/')

    await openPostDialog()
    expect(screen.getByLabelText('ニックネーム')).toHaveValue('')
    expect(screen.getByLabelText('あるある')).toHaveValue('')
  })

  it('審査中にブラウザバックすると審査停止確認モーダルを表示する', async () => {
    setupPendingPostApiMocks()

    render(<App />)
    await openPostDialog()
    fillPostForm({ nickname: 'バック太郎', body: 'ブラウザバック確認本文' })
    await submitPostForm()

    await waitFor(() => {
      expect(screen.getByTestId('judging-screen')).toBeInTheDocument()
    })

    fireEvent.popState(window)

    expect(screen.getByRole('dialog', { name: '審査停止確認' })).toBeInTheDocument()
  })

  it('審査中はbeforeunloadでページ離脱警告の対象になる', async () => {
    setupPendingPostApiMocks()

    render(<App />)
    await openPostDialog()
    fillPostForm({ nickname: '離脱太郎', body: '離脱警告確認本文' })
    await submitPostForm()

    await waitFor(() => {
      expect(screen.getByTestId('judging-screen')).toBeInTheDocument()
    })

    const beforeUnloadEvent = new Event('beforeunload', { cancelable: true })
    const dispatchResult = window.dispatchEvent(beforeUnloadEvent)
    expect(dispatchResult).toBe(false)
    expect(beforeUnloadEvent.defaultPrevented).toBe(true)
  })
})
