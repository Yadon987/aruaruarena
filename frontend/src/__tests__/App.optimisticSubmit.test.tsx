import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiClientError } from '../shared/services/api'
import App from '../App'
import { fillPostForm, openPostDialog, submitPostForm } from '../test/helpers'
import { api } from '../shared/services/api'

type AudioDebugEvent =
  | { type: 'bgm'; scene: 'top' | 'judging' | 'success' | 'failed' }
  | { type: 'se'; id: 'se_submit' | 'se_result_open' | 'se_retry' }

function getAudioDebugEvents(): AudioDebugEvent[] {
  return (globalThis as { __AUDIO_DEBUG__?: AudioDebugEvent[] }).__AUDIO_DEBUG__ ?? []
}

describe('E12-XX RED: 楽観的投稿UI', () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.replaceState({}, '', '/')
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('__AUDIO_DEBUG__', [])
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('API通信完了前に投稿モーダルが閉じて審査中画面へ遷移する', async () => {
    vi.spyOn(api.posts, 'create').mockImplementation(
      () => new Promise(() => {})
    )
    vi.spyOn(api.posts, 'get').mockImplementation(() => new Promise(() => {})
    )
    localStorage.setItem('aruaru_sound_muted', 'false')

    render(<App />)
    fireEvent.pointerDown(document.body)
    await openPostDialog()
    fillPostForm({ nickname: '楽観太郎', body: 'API待機前に表示されるテスト' })
    await submitPostForm()

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.getByTestId('judging-screen')).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(getAudioDebugEvents()).toContainEqual({ type: 'se', id: 'se_submit' })
    })
  })

  it('暫定postIdで審査中へ入り、成功時に正式postIdへ置き換える', async () => {
    const tempPostId = '11111111-1111-4111-8111-111111111111'
    const pushStateSpy = vi
      .spyOn(window.history, 'pushState')
      .mockImplementation(() => {})
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(tempPostId)
    vi.spyOn(api.posts, 'create').mockResolvedValue({
      id: 'official-post-id',
      status: 'judging',
    })
    vi.spyOn(api.posts, 'get').mockResolvedValue({
      id: 'official-post-id',
      nickname: '楽観太郎',
      body: 'API遅延時でも一瞬で遷移する',
      status: 'judging',
      created_at: '2026-03-07T00:00:00Z',
      judgments: [],
    })

    render(<App />)
    await openPostDialog()
    fillPostForm({ nickname: '楽観太郎', body: 'API遅延時でも一瞬で遷移する' })
    await submitPostForm({ waitForSubmit: () => Promise.resolve() })

    await waitFor(() => {
      expect(screen.getByTestId('judging-screen')).toBeInTheDocument()
      expect(pushStateSpy).toHaveBeenCalledTimes(2)
    })
    expect(pushStateSpy).toHaveBeenNthCalledWith(1, {}, '', `/judging/${tempPostId}`)
    expect(pushStateSpy).toHaveBeenNthCalledWith(2, {}, '', '/judging/official-post-id')
  })

  it('API失敗時は審査中画面に再投稿導線を出し、入力値を復元する', async () => {
    vi.spyOn(api.posts, 'create').mockRejectedValue(
      new ApiClientError('Network error', 'NETWORK_ERROR', 0)
    )
    vi.spyOn(api.posts, 'get').mockImplementation(() => new Promise(() => {})
    )

    render(<App />)
    await openPostDialog()
    fillPostForm({ nickname: '失敗太郎', body: '再投稿までの入力保持' })
    await submitPostForm({ waitForSubmit: () => Promise.resolve() })

    await waitFor(() => {
      expect(screen.getByText('ネットワークに接続できませんでした')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '再投稿する' })).toBeInTheDocument()
    })
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Post creation failed'),
      expect.any(ApiClientError)
    )

    fireEvent.click(screen.getByRole('button', { name: '再投稿する' }))
    expect(screen.getByRole('dialog', { name: '投稿フォーム' })).toBeInTheDocument()
    expect(screen.getByLabelText('ニックネーム')).toHaveValue('失敗太郎')
    expect(screen.getByLabelText('あるある')).toHaveValue('再投稿までの入力保持')
  })

  it('再投稿導線からの再送信時にAPI呼び出しは1度に限定される', async () => {
    let resolveRetryRequest: ((value: { id: string; status: 'judging' }) => void) | undefined
    const retryRequest = new Promise<{ id: string; status: 'judging' }>((resolve) => {
      resolveRetryRequest = resolve
    })

    const createSpy = vi
      .spyOn(api.posts, 'create')
      .mockRejectedValueOnce(new ApiClientError('Network error', 'NETWORK_ERROR', 0))
      .mockReturnValueOnce(retryRequest)
      .mockResolvedValue({
        id: 'official-post-id',
        status: 'judging',
      })

    vi.spyOn(api.posts, 'get').mockResolvedValue({
      id: 'official-post-id',
      nickname: '失敗太郎',
      body: '再投稿までの入力保持',
      status: 'judging',
      created_at: '2026-03-07T00:00:00Z',
      judgments: [],
    })

    render(<App />)
    await openPostDialog()
    fillPostForm({ nickname: '失敗太郎', body: '再投稿までの入力保持' })
    await submitPostForm({ waitForSubmit: () => Promise.resolve() })

    await waitFor(() => {
      expect(screen.getByText('ネットワークに接続できませんでした')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '再投稿する' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '再投稿する' }))

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: '投稿フォーム' })).toBeInTheDocument()
    })
    expect(screen.getByLabelText('ニックネーム')).toHaveValue('失敗太郎')
    expect(screen.getByLabelText('あるある')).toHaveValue('再投稿までの入力保持')

    const repostButton = screen.getByRole('button', { name: '投稿' })
    fireEvent.click(repostButton)
    fireEvent.click(repostButton)

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledTimes(2)
    })

    resolveRetryRequest?.({
      id: 'official-post-id',
      status: 'judging',
    })
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '投稿フォーム' })).not.toBeInTheDocument()
      expect(screen.getByTestId('judging-screen')).toBeInTheDocument()
    })

    expect(createSpy).toHaveBeenCalledTimes(2)
  })
})
