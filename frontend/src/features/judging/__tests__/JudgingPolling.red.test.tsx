import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeAll, afterAll, afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import App from '../../../App'
import { mswServer } from '../../../mocks/server'
import { api } from '../../../shared/services/api'

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

    fireEvent.change(screen.getByLabelText('ニックネーム'), { target: { value: 'RED太郎' } })
    fireEvent.change(screen.getByLabelText('あるある本文'), { target: { value: 'REDテスト本文です' } })
    fireEvent.click(screen.getByRole('button', { name: '投稿する' }))

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

    fireEvent.change(screen.getByLabelText('ニックネーム'), { target: { value: 'RED太郎' } })
    fireEvent.change(screen.getByLabelText('あるある本文'), { target: { value: 'REDテスト本文です' } })
    fireEvent.click(screen.getByRole('button', { name: '投稿する' }))

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

    fireEvent.change(screen.getByLabelText('ニックネーム'), { target: { value: 'RED太郎' } })
    fireEvent.change(screen.getByLabelText('あるある本文'), { target: { value: 'REDテスト本文です' } })
    fireEvent.click(screen.getByRole('button', { name: '投稿する' }))

    await waitFor(() => {
      expect(screen.getByText('審査結果')).toBeInTheDocument()
    })
  })

  it('GET /api/posts/:id が404のとき取得失敗モーダルを表示してトップへ戻る', async () => {
    // 何を検証するか: 404応答時にエラーモーダル文言を表示して待機を終了すること
    mswServer.use(
      http.get('/api/posts/:id', () => {
        return HttpResponse.json(
          { error: '投稿が見つかりません', code: 'NOT_FOUND' },
          { status: 404 }
        )
      })
    )

    render(<App />)

    fireEvent.change(screen.getByLabelText('ニックネーム'), { target: { value: 'RED太郎' } })
    fireEvent.change(screen.getByLabelText('あるある本文'), { target: { value: 'REDテスト本文です' } })
    fireEvent.click(screen.getByRole('button', { name: '投稿する' }))

    await waitFor(() => {
      expect(
        screen.getByText('投稿情報の取得に失敗しました。トップへ戻って再度お試しください。')
      ).toBeInTheDocument()
    })
  })

  it('GET /api/posts/:id が500でも150秒枠内は再試行を継続する', async () => {
    // 何を検証するか: サーバーエラー時に1回で停止せず次周期で再試行すること
    mswServer.use(
      http.get('/api/posts/:id', () => {
        return HttpResponse.json(
          { error: '一時的な障害', code: 'INTERNAL_ERROR' },
          { status: 500 }
        )
      })
    )

    render(<App />)

    fireEvent.change(screen.getByLabelText('ニックネーム'), { target: { value: 'RED太郎' } })
    fireEvent.change(screen.getByLabelText('あるある本文'), { target: { value: 'REDテスト本文です' } })
    fireEvent.click(screen.getByRole('button', { name: '投稿する' }))

    await waitFor(
      () => {
        expect(getPostSpy).toHaveBeenCalledTimes(2)
      },
      { timeout: 5000 }
    )
  })

  it('不正な投稿IDではポーリングせず取得失敗モーダルを表示する', async () => {
    // 何を検証するか: 不正IDの場合にGETを呼ばずにエラー表示へ遷移すること
    window.history.pushState({}, '', '/judging/invalid-id')

    render(<App />)

    await waitFor(() => {
      expect(
        screen.getByText('投稿情報の取得に失敗しました。トップへ戻って再度お試しください。')
      ).toBeInTheDocument()
    })

    expect(getPostSpy).not.toHaveBeenCalled()
  })
})
