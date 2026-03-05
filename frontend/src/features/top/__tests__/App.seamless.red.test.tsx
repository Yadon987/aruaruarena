import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../mocks/browser', () => ({
  worker: {
    start: () => Promise.resolve(),
    stop: () => Promise.resolve(),
  },
}))

import { api } from '../../../shared/services/api'

vi.mock('../../../shared/hooks/useRankings', () => ({
  useRankings: vi.fn(() => ({
    data: { rankings: [], total_count: 0 },
    isLoading: false,
    isError: false,
    error: null,
  })),
}))

const loadApp = async () => {
  return import('../../../App')
}

const fillAndSubmitPost = async () => {
  fireEvent.click(screen.getByRole('button', { name: '投稿する' }))
  await screen.findByRole('dialog', { name: '投稿フォーム' })

  fireEvent.change(screen.getByLabelText('ニックネーム'), {
    target: { value: 'テスト' },
  })
  fireEvent.change(screen.getByLabelText('あるある'), {
    target: { value: 'テスト投稿' },
  })
  fireEvent.click(screen.getByRole('button', { name: '投稿' }))
  await waitFor(() => {
    expect(api.posts.create).toHaveBeenCalledTimes(1)
  })

  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
}

describe('E24-07 RED: App Seamless UI Integration', () => {
  beforeEach(() => {
    vi.spyOn(api.posts, 'create').mockResolvedValue({
      id: 'seamless-post-id',
      status: 'judging',
    })
    vi.spyOn(api.posts, 'get').mockResolvedValue({
      id: 'seamless-post-id',
      nickname: 'テスト太郎',
      body: 'テスト本文',
      status: 'scored',
      created_at: '2026-03-01T00:00:00Z',
      average_score: 90.0,
      rank: 1,
      total_count: 10,
      judgments: [],
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('初期表示で審査員が背景に表示される', async () => {
    // 何を検証するか: FR-01 - 審査員3名が常に背景に表示されること
    const { default: App } = await loadApp()

    render(<App />)

    const avatars = screen
      .getAllByRole('img')
      .filter((img) => img.getAttribute('alt')?.includes('審査員'))
    expect(avatars).toHaveLength(3)
  })

  it('投稿ボタンでモーダルが開く', async () => {
    // 何を検証するか: FR-04 - 投稿フォームがモーダルとして表示されること
    const { default: App } = await loadApp()

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '投稿する' }))

    expect(await screen.findByRole('dialog', { name: '投稿フォーム' })).toBeInTheDocument()
  })

  it('モーダル中は口癖が表示されない', async () => {
    // 何を検証するか: FR-09 - モーダルオープン中は口癖表示を停止すること
    const { default: App } = await loadApp()

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '投稿する' }))

    expect(await screen.findByRole('dialog', { name: '投稿フォーム' })).toBeInTheDocument()

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('投稿完了でモーダルが閉じ、審査中になる', async () => {
    // 何を検証するか: FR-05 - 投稿完了時、モーダルが閉じ審査員が口癖発話を開始すること
    const { default: App } = await loadApp()

    render(<App />)
    await fillAndSubmitPost()

    await waitFor(() => {
      expect(screen.getByText(/審査中/)).toBeInTheDocument()
    })
  })

  it('審査中に投稿内容（ニックネーム・本文）が表示される', async () => {
    // 何を検証するか: FR-07 - 審査中の投稿内容が画面表示されること
    const { default: App } = await loadApp()

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '投稿する' }))
    await screen.findByRole('dialog', { name: '投稿フォーム' })

    fireEvent.change(screen.getByLabelText('ニックネーム'), {
      target: { value: 'テスト太郎' },
    })
    fireEvent.change(screen.getByLabelText('あるある'), {
      target: { value: 'テスト本文' },
    })
    fireEvent.click(screen.getByRole('button', { name: '投稿' }))

    await waitFor(() => {
      expect(screen.getByText(/テスト太郎/)).toBeInTheDocument()
      expect(screen.getByText(/テスト本文/)).toBeInTheDocument()
    })
  })

  it('審査中に口癖が表示される', async () => {
    // 何を検証するか: FR-06 - 審査中に口癖発話が表示されること
    const { default: App } = await loadApp()
    vi.mocked(api.posts.get).mockResolvedValueOnce({
      id: 'seamless-post-id',
      nickname: 'テスト太郎',
      body: 'テスト本文',
      status: 'judging',
      created_at: '2026-03-01T00:00:00Z',
      judgments: [],
    })

    render(<App />)
    await fillAndSubmitPost()

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument()
    })
  })

  it('審査完了で結果モーダルが表示される', async () => {
    // 何を検証するか: FR-08 - 審査完了時、結果モーダルが表示されること
    const { default: App } = await loadApp()

    render(<App />)
    await fillAndSubmitPost()

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /審査結果/ })).toBeInTheDocument()
    })
  })

  it('結果モーダル表示後、審査員は待機状態に戻る', async () => {
    // 何を検証するか: FR-08 - 審査完了時、審査員は待機状態に戻ること
    const { default: App } = await loadApp()

    render(<App />)
    await fillAndSubmitPost()

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /審査結果/ })).toBeInTheDocument()
    })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
