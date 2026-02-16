import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeAll, afterAll, afterEach, describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import App from '../../../App'
import { mswServer } from '../../../mocks/server'

describe('E12-01 RED: TopPage Integration', () => {
  beforeAll(() => mswServer.listen({ onUnhandledRequest: 'error' }))
  afterEach(() => {
    mswServer.resetHandlers()
    localStorage.clear()
  })
  afterAll(() => mswServer.close())

  it('POST成功時にmy_post_idsへ保存する', async () => {
    // 何を検証するか: API成功後にLocalStorageへ投稿IDが保存されること
    mswServer.use(
      http.post('/api/posts', () => {
        return HttpResponse.json({ id: 'post-success-1', status: 'judging' })
      })
    )

    localStorage.setItem('my_post_ids', JSON.stringify([]))
    render(<App />)

    fireEvent.change(screen.getByLabelText('ニックネーム'), { target: { value: '統合太郎' } })
    fireEvent.change(screen.getByLabelText('あるある本文'), { target: { value: '統合テスト本文です' } })
    fireEvent.click(screen.getByRole('button', { name: '投稿する' }))

    await waitFor(() => {
      expect(localStorage.getItem('my_post_ids')).toContain('post-success-1')
    })
  })

  it('429エラー時に専用メッセージを表示し入力を保持する', async () => {
    // 何を検証するか: RATE_LIMITED時の専用文言表示と入力保持が行われること
    mswServer.use(
      http.post('/api/posts', () => {
        return HttpResponse.json(
          { error: '投稿頻度を制限中', code: 'RATE_LIMITED' },
          { status: 429 }
        )
      })
    )

    render(<App />)

    fireEvent.change(screen.getByLabelText('ニックネーム'), { target: { value: '制限太郎' } })
    fireEvent.change(screen.getByLabelText('あるある本文'), { target: { value: '投稿テキストです' } })
    fireEvent.click(screen.getByRole('button', { name: '投稿する' }))

    await waitFor(() => {
      expect(screen.getByText('5分後に再投稿してください')).toBeInTheDocument()
    })
    expect(screen.getByLabelText('ニックネーム')).toHaveValue('制限太郎')
    expect(screen.getByLabelText('あるある本文')).toHaveValue('投稿テキストです')
  })

  it('500エラー時に汎用メッセージを表示し入力を保持する', async () => {
    // 何を検証するか: サーバーエラー時に汎用文言表示と入力保持が行われること
    mswServer.use(
      http.post('/api/posts', () => {
        return HttpResponse.json(
          { error: 'Internal Server Error', code: 'INTERNAL_ERROR' },
          { status: 500 }
        )
      })
    )

    render(<App />)

    fireEvent.change(screen.getByLabelText('ニックネーム'), { target: { value: '障害太郎' } })
    fireEvent.change(screen.getByLabelText('あるある本文'), { target: { value: '障害テスト本文です' } })
    fireEvent.click(screen.getByRole('button', { name: '投稿する' }))

    await waitFor(() => {
      expect(screen.getByText('一時的なエラーです。時間をおいて再試行してください')).toBeInTheDocument()
    })
    expect(screen.getByLabelText('ニックネーム')).toHaveValue('障害太郎')
    expect(screen.getByLabelText('あるある本文')).toHaveValue('障害テスト本文です')
  })

  it('my_post_idsが不正JSONでも投稿成功時に保存できる', async () => {
    // 何を検証するか: LocalStorageの不正値を空配列として扱い保存を継続できること
    mswServer.use(
      http.post('/api/posts', () => {
        return HttpResponse.json({ id: 'post-malformed-1', status: 'judging' })
      })
    )

    localStorage.setItem('my_post_ids', '{not-json')
    render(<App />)

    fireEvent.change(screen.getByLabelText('ニックネーム'), { target: { value: '復旧太郎' } })
    fireEvent.change(screen.getByLabelText('あるある本文'), { target: { value: '復旧テスト本文です' } })
    fireEvent.click(screen.getByRole('button', { name: '投稿する' }))

    await waitFor(() => {
      expect(localStorage.getItem('my_post_ids')).toContain('post-malformed-1')
    })
  })

  it('通信失敗時に既定エラーメッセージを表示し入力を保持する', async () => {
    // 何を検証するか: ネットワーク失敗時に入力保持と既定エラー表示が行われること
    mswServer.use(
      http.post('/api/posts', () => {
        return HttpResponse.error()
      })
    )

    render(<App />)

    fireEvent.change(screen.getByLabelText('ニックネーム'), { target: { value: '通信太郎' } })
    fireEvent.change(screen.getByLabelText('あるある本文'), { target: { value: '通信失敗テスト本文です' } })
    fireEvent.click(screen.getByRole('button', { name: '投稿する' }))

    await waitFor(() => {
      expect(screen.getByText('エラーが発生しました。再試行してください')).toBeInTheDocument()
    })
    expect(screen.getByLabelText('ニックネーム')).toHaveValue('通信太郎')
    expect(screen.getByLabelText('あるある本文')).toHaveValue('通信失敗テスト本文です')
  })
})
