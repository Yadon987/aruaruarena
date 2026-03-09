import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import App from '../../../App'
import { mswServer } from '../../../mocks/server'
import { fillAndSubmitPostForm } from '../../../test/helpers'

describe('E12-01 RED: TopPage Integration', () => {
  beforeAll(() => mswServer.listen({ onUnhandledRequest: 'error' }))
  afterEach(() => {
    mswServer.resetHandlers()
    localStorage.clear()
  })
  afterAll(() => mswServer.close())

  async function expectRetryRestoresFormInput(nickname: string, body: string) {
    const retryButton = screen.getByRole('button', { name: '再投稿する' })
    fireEvent.click(retryButton)
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '再投稿する' })).not.toBeInTheDocument()
    })

    const dialog = await screen.findByRole('dialog', { name: '投稿フォーム' })
    expect(dialog).toBeInTheDocument()
    expect(screen.getByLabelText('ニックネーム')).toHaveValue(nickname)
    expect(screen.getByLabelText('あるある')).toHaveValue(body)
  }

  it('POST成功時にmy_post_idsへ保存する', async () => {
    // 何を検証するか: API成功後にLocalStorageへ投稿IDが保存されること
    mswServer.use(
      http.post('/api/posts', () => {
        return HttpResponse.json({ id: 'post-success-1', status: 'judging' })
      })
    )

    localStorage.setItem('my_post_ids', JSON.stringify([]))
    render(<App />)

    await fillAndSubmitPostForm({ nickname: '統合太郎', body: '統合テスト本文です' })

    await waitFor(() => {
      expect(localStorage.getItem('my_post_ids')).toContain('post-success-1')
    })
  })

  it('429エラー時に専用メッセージを表示し入力を保持する', async () => {
    // 何を検証するか: RATE_LIMITED時に専用文言表示後、再投稿で入力復元されること
    mswServer.use(
      http.post('/api/posts', () => {
        return HttpResponse.json(
          { error: '投稿頻度を制限中', code: 'RATE_LIMITED' },
          { status: 429 }
        )
      })
    )

    render(<App />)

    await fillAndSubmitPostForm({ nickname: '制限太郎', body: '投稿テキストです' })

    await waitFor(() => {
      expect(screen.getByText('投稿に失敗しました')).toBeInTheDocument()
    })
    await expectRetryRestoresFormInput('制限太郎', '投稿テキストです')
  })

  it('500エラー時に汎用メッセージを表示し入力を保持する', async () => {
    // 何を検証するか: サーバーエラー時に汎用文言表示後、再投稿で入力復元されること
    mswServer.use(
      http.post('/api/posts', () => {
        return HttpResponse.json(
          { error: 'Internal Server Error', code: 'INTERNAL_ERROR' },
          { status: 500 }
        )
      })
    )

    render(<App />)

    await fillAndSubmitPostForm({ nickname: '障害太郎', body: '障害テスト本文です' })

    await waitFor(() => {
      expect(screen.getByText('サーバーエラーが発生しました')).toBeInTheDocument()
    })
    await expectRetryRestoresFormInput('障害太郎', '障害テスト本文です')
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

    await fillAndSubmitPostForm({ nickname: '復旧太郎', body: '復旧テスト本文です' })

    await waitFor(() => {
      expect(localStorage.getItem('my_post_ids')).toContain('post-malformed-1')
    })
  })

  it('通信失敗時に既定エラーメッセージを表示し入力を保持する', async () => {
    // 何を検証するか: ネットワーク失敗時に既定エラー表示後、再投稿で入力復元されること
    mswServer.use(
      http.post('/api/posts', () => {
        return HttpResponse.error()
      })
    )

    render(<App />)

    await fillAndSubmitPostForm({ nickname: '通信太郎', body: '通信失敗テスト本文です' })

    await waitFor(() => {
      expect(screen.getByText('ネットワークに接続できませんでした')).toBeInTheDocument()
    })
    await expectRetryRestoresFormInput('通信太郎', '通信失敗テスト本文です')
  })
})
