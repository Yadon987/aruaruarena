import { render, screen, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../../App'
import { mswServer } from '../../../mocks/server'
import { api } from '../../../shared/services/api'
import { fillAndSubmitPostForm } from '../../../test/helpers'

describe('E13-02 RED: 審査中ポーリングとタイムアウト', () => {
  const getPostSpy = vi.spyOn(api.posts, 'get')

  beforeAll(() => mswServer.listen({ onUnhandledRequest: 'error' }))

  afterEach(() => {
    mswServer.resetHandlers()
    localStorage.clear()
    getPostSpy.mockClear()
    window.history.replaceState({}, '', '/')
  })

  afterAll(() => {
    mswServer.close()
    getPostSpy.mockRestore()
  })

  beforeEach(() => {
    mswServer.use(
      http.post('/api/posts', () => {
        return HttpResponse.json({ id: 'polling-test', status: 'judging' })
      })
    )
  })

  it('投稿成功後に審査中画面へ遷移し、投稿IDでポーリングを開始する', async () => {
    // 何を検証するか: 投稿成功後に審査中画面を表示し GET /api/posts/:id を開始すること
    render(<App />)

    await fillAndSubmitPostForm({ nickname: 'RED太郎', body: 'REDテスト本文です' })

    await waitFor(() => {
      expect(screen.getByTestId('judging-screen')).toBeInTheDocument()
    })

    await waitFor(
      () => {
        expect(getPostSpy).toHaveBeenCalledWith(
          'polling-test',
          expect.objectContaining({ signal: expect.any(AbortSignal) })
        )
      },
      { timeout: 3500 }
    )
  })

  it('status=scored を受信したらポーリング停止して審査結果画面へ遷移する', async () => {
    // 何を検証するか: scored受信時に審査中を終了し審査結果画面へ遷移すること
    mswServer.use(
      http.get('/api/posts/:id', () => {
        return HttpResponse.json({
          id: 'polling-test',
          nickname: 'RED太郎',
          body: '本文',
          status: 'scored',
          created_at: '2026-02-16T00:00:00Z',
        })
      })
    )

    render(<App />)

    await fillAndSubmitPostForm({ nickname: 'RED太郎', body: 'REDテスト本文です' })

    await waitFor(() => {
      expect(screen.getByText('審査結果')).toBeInTheDocument()
    })
  })

  it('status=failed を受信したらポーリング停止して審査結果画面へ遷移する', async () => {
    // 何を検証するか: failed受信時に審査中を終了し審査結果画面へ遷移すること
    mswServer.use(
      http.get('/api/posts/:id', () => {
        return HttpResponse.json({
          id: 'polling-test',
          nickname: 'RED太郎',
          body: '本文',
          status: 'failed',
          created_at: '2026-02-16T00:00:00Z',
        })
      })
    )

    render(<App />)

    await fillAndSubmitPostForm({ nickname: 'RED太郎', body: 'REDテスト本文です' })

    await waitFor(() => {
      expect(screen.getByText('審査結果')).toBeInTheDocument()
    })
  })

  it('GET /api/posts/:id が404のとき取得失敗モーダルを表示してトップへ戻る', async () => {
    // 何を検証するか: 404応答時に審査待機を停止してトップへ戻ること
    mswServer.use(
      http.get('/api/posts/:id', () => {
        return HttpResponse.json(
          { error: '投稿が見つかりません', code: 'NOT_FOUND' },
          { status: 404 }
        )
      })
    )

    render(<App />)

    await fillAndSubmitPostForm({ nickname: 'RED太郎', body: 'REDテスト本文です' })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '投稿する' })).toBeInTheDocument()
      expect(screen.queryByTestId('judging-screen')).not.toBeInTheDocument()
    })
  })

  it('GET /api/posts/:id が500でも60秒枠内は再試行を継続する', async () => {
    // 何を検証するか: サーバーエラー時に1回で停止せず次周期で再試行すること
    mswServer.use(
      http.get('/api/posts/:id', () => {
        return HttpResponse.json({ error: '一時的な障害', code: 'INTERNAL_ERROR' }, { status: 500 })
      })
    )

    render(<App />)

    await fillAndSubmitPostForm({ nickname: 'RED太郎', body: 'REDテスト本文です' })

    await waitFor(
      () => {
        expect(getPostSpy).toHaveBeenCalledTimes(2)
      },
      { timeout: 5000 }
    )
  })

  it('不正な投稿IDではポーリングせず取得失敗モーダルを表示する', async () => {
    // 何を検証するか: 不正IDの場合にGETを呼ばずトップへ戻ること
    window.history.pushState({}, '', '/judging/invalid-id')

    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '投稿する' })).toBeInTheDocument()
      expect(screen.queryByTestId('judging-screen')).not.toBeInTheDocument()
    })

    expect(getPostSpy).not.toHaveBeenCalled()
  })
})
