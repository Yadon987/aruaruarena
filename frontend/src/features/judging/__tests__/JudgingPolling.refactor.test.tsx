import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import App from '../../../App'
import { mswServer } from '../../../mocks/server'
import { api } from '../../../shared/services/api'

describe('E13-02 Refactor: 審査中ポーリング境界値', () => {
  const getPostSpy = vi.spyOn(api.posts, 'get')
  let dateNowSpy: ReturnType<typeof vi.spyOn> | null = null

  beforeAll(() => mswServer.listen({ onUnhandledRequest: 'error' }))

  beforeEach(() => {
    window.history.replaceState({}, '', '/')
    mswServer.use(
      http.post('/api/posts', () => {
        return HttpResponse.json({ id: 'polling-test', status: 'judging' })
      }),
      http.get('/api/posts/:id', () => {
        return HttpResponse.json(
          { error: '一時的な障害', code: 'INTERNAL_ERROR' },
          { status: 500 }
        )
      })
    )
  })

  afterEach(() => {
    mswServer.resetHandlers()
    localStorage.clear()
    getPostSpy.mockClear()
    if (dateNowSpy) {
      dateNowSpy.mockRestore()
      dateNowSpy = null
    }
  })

  afterAll(() => {
    mswServer.close()
    getPostSpy.mockRestore()
  })

  it('150秒未満の経過時間ではタイムアウトせず審査中画面を維持する', async () => {
    // 何を検証するか: 150秒未満の判定では監視を継続し審査中画面を維持すること
    const baseTime = 1_700_000_000_000
    let currentTime = baseTime
    dateNowSpy = vi.spyOn(Date, 'now').mockImplementation(() => currentTime)
    render(<App />)

    fireEvent.change(screen.getByLabelText('ニックネーム'), { target: { value: '境界太郎' } })
    fireEvent.change(screen.getByLabelText('あるある本文'), { target: { value: '境界値テスト本文です' } })
    fireEvent.click(screen.getByRole('button', { name: '投稿する' }))

    await waitFor(() => {
      expect(screen.getByTestId('judging-screen')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(getPostSpy).toHaveBeenCalledTimes(1)
    })

    currentTime = baseTime + 149_000

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 3200))
    })

    expect(screen.getByTestId('judging-screen')).toBeInTheDocument()
    expect(screen.queryByText('投稿情報の取得に失敗しました。トップへ戻って再度お試しください。')).not.toBeInTheDocument()
  }, 10000)

  it('150秒到達時にポーリングを停止し固定エラーメッセージを表示する', async () => {
    // 何を検証するか: 150秒到達でAPI追加送信せずトップ復帰して固定文言を表示すること
    const baseTime = 1_700_000_000_000
    let currentTime = baseTime
    dateNowSpy = vi.spyOn(Date, 'now').mockImplementation(() => currentTime)
    render(<App />)

    fireEvent.change(screen.getByLabelText('ニックネーム'), { target: { value: '境界太郎' } })
    fireEvent.change(screen.getByLabelText('あるある本文'), { target: { value: '境界値テスト本文です' } })
    fireEvent.click(screen.getByRole('button', { name: '投稿する' }))

    await waitFor(() => {
      expect(screen.getByTestId('judging-screen')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(getPostSpy).toHaveBeenCalledTimes(1)
    })

    currentTime = baseTime + 150_000

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 3200))
    })

    expect(
      screen.getByText('投稿情報の取得に失敗しました。トップへ戻って再度お試しください。')
    ).toBeInTheDocument()
  }, 10000)
})
