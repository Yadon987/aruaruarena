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
      expect(screen.queryByRole('button', { name: '投稿する' })).not.toBeInTheDocument()
      expect(screen.getByTestId('top-judge-dock')).toBeInTheDocument()
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

  it('GET /api/posts/:id が404のとき審査エラーパネルを表示する', async () => {
    // 何を検証するか: 404応答時に審査待機を停止して審査エラー導線を表示すること
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
      expect(screen.getByTestId('judging-screen')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '再投稿する' })).toBeInTheDocument()
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
    expect(
      screen.queryByText('通信が不安定です（1/4）。再接続を試しています...')
    ).not.toBeInTheDocument()
  })

  it('AI API通信エラーコード(provider_error)で進捗メッセージを表示する', async () => {
    // 何を検証するか: AI接続系コードを受け取った場合に通信エラー進捗を表示すること
    mswServer.use(
      http.get('/api/posts/:id', () => {
        return HttpResponse.json({ error: 'AI接続に失敗', code: 'provider_error' }, { status: 503 })
      })
    )

    render(<App />)

    await fillAndSubmitPostForm({ nickname: 'RED太郎', body: 'REDテスト本文です' })

    await waitFor(() => {
      expect(
        screen.getByText('通信が不安定です（1/4）。再接続を試しています...')
      ).toBeInTheDocument()
    })
  })

  it('通信エラーが連続したとき60秒を待たずに審査エラーパネルを表示する', async () => {
    // 何を検証するか: ネットワーク障害が連続する場合に早期終了して審査エラー導線を表示すること
    mswServer.use(
      http.get('/api/posts/:id', () => {
        return HttpResponse.error()
      })
    )

    render(<App />)

    await fillAndSubmitPostForm({ nickname: 'RED太郎', body: 'REDテスト本文です' })

    await waitFor(
      () => {
        expect(screen.getByTestId('judging-screen')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '再投稿する' })).toBeInTheDocument()
      },
      { timeout: 12000 }
    )

    expect(getPostSpy).toHaveBeenCalledTimes(4)
  }, 14000)

  it('通信エラー発生時に進捗メッセージ（1/4）を頭上中央に表示する', async () => {
    // 何を検証するか: 通信エラー直後に再接続試行中の進捗表示が見えること
    mswServer.use(
      http.get('/api/posts/:id', () => {
        return HttpResponse.error()
      })
    )

    render(<App />)

    await fillAndSubmitPostForm({ nickname: 'RED太郎', body: 'REDテスト本文です' })

    await waitFor(() => {
      expect(
        screen.getByText('通信が不安定です（1/4）。再接続を試しています...')
      ).toBeInTheDocument()
    })
  })

  it('不正な投稿IDではポーリングせず審査エラーパネルを表示する', async () => {
    // 何を検証するか: 不正IDの場合にGETを呼ばず審査エラー導線を表示すること
    window.history.pushState({}, '', '/judging/invalid-id')

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('judging-screen')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '再投稿する' })).toBeInTheDocument()
    })

    expect(getPostSpy).not.toHaveBeenCalled()
  })
})
