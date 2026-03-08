import { act, render, screen, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../../App'
import { mswServer } from '../../../mocks/server'
import { api } from '../../../shared/services/api'
import { fillAndSubmitPostForm } from '../../../test/helpers'

describe('E13-02 Refactor: 審査中ポーリング境界値', () => {
  const getPostSpy = vi.spyOn(api.posts, 'get')
  let dateNowSpy: ReturnType<typeof vi.spyOn> | null = null

  beforeAll(() => mswServer.listen({ onUnhandledRequest: 'error' }))

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    window.history.replaceState({}, '', '/')
    mswServer.use(
      http.post('/api/posts', () => {
        return HttpResponse.json({ id: 'polling-test', status: 'judging' })
      }),
      http.get('/api/posts/:id', () => {
        return HttpResponse.json({ error: '一時的な障害', code: 'INTERNAL_ERROR' }, { status: 500 })
      })
    )
  })

  afterEach(() => {
    mswServer.resetHandlers()
    localStorage.clear()
    getPostSpy.mockClear()
    vi.useRealTimers()
    if (dateNowSpy) {
      dateNowSpy.mockRestore()
      dateNowSpy = null
    }
  })

  afterAll(() => {
    mswServer.close()
    getPostSpy.mockRestore()
  })

  it('60秒未満の経過時間ではタイムアウトせず審査中画面を維持する', async () => {
    // 何を検証するか: 60秒未満の判定では監視を継続し審査中画面を維持すること
    const baseTime = 1_700_000_000_000
    let currentTime = baseTime
    dateNowSpy = vi.spyOn(Date, 'now').mockImplementation(() => currentTime)
    render(<App />)

    await fillAndSubmitPostForm({ nickname: '境界太郎', body: '境界値テスト本文です' })

    await waitFor(() => {
      expect(screen.getByTestId('judging-screen')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(getPostSpy).toHaveBeenCalledTimes(1)
    })

    currentTime = baseTime + 59_000

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3200)
    })

    expect(screen.getByTestId('judging-screen')).toBeInTheDocument()
    expect(
      screen.queryByText('投稿情報の取得に失敗しました。トップへ戻って再度お試しください。')
    ).not.toBeInTheDocument()
  }, 10000)

  it('60秒到達時にポーリングを停止し固定エラーメッセージを表示する', async () => {
    // 何を検証するか: 60秒到達でポーリング停止しトップ復帰すること
    const baseTime = 1_700_000_000_000
    let currentTime = baseTime
    dateNowSpy = vi.spyOn(Date, 'now').mockImplementation(() => currentTime)
    render(<App />)

    await fillAndSubmitPostForm({ nickname: '境界太郎', body: '境界値テスト本文です' })

    await waitFor(() => {
      expect(screen.getByTestId('judging-screen')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(getPostSpy).toHaveBeenCalledTimes(1)
    })

    currentTime = baseTime + 60_000

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3200)
    })

    expect(screen.getByRole('button', { name: '投稿する' })).toBeInTheDocument()
    expect(screen.queryByTestId('judging-screen')).not.toBeInTheDocument()
    expect(getPostSpy).toHaveBeenCalledTimes(1)
  }, 10000)
})
