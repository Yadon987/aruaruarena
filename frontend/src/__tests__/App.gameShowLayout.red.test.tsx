import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'

vi.mock('../mocks/browser', () => ({
  worker: {
    start: () => Promise.resolve(),
    stop: () => Promise.resolve(),
  },
}))

vi.mock('../shared/hooks/useRankings', () => ({
  useRankings: vi.fn(() => ({
    data: { rankings: [], total_count: 0 },
    isLoading: false,
    isError: false,
    error: null,
  })),
}))

describe('E25-01 RED: App Game Show Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('背景タイトルコンポーネントが表示される', () => {
    // 何を検証するか: E25-01の受け入れ基準として、背景に「あるあるアリーナ」の専用タイトル要素が存在すること
    render(<App />)

    expect(screen.getByTestId('background-title')).toBeInTheDocument()
  })

  it('ヘッダー右上に「投稿する」「音声切り替え」が並ぶ', () => {
    // 何を検証するか: E25-01の受け入れ基準として、ヘッダー内に2つの操作ボタンが横並びで配置されること
    render(<App />)

    const header = screen.getByRole('banner')
    expect(within(header).getByRole('button', { name: '投稿する' })).toBeInTheDocument()
    expect(within(header).getByRole('button', { name: '音声切り替え' })).toBeInTheDocument()
  })

  it('フッターに「自分の投稿」「ランキング」「プライバシーポリシー」が並ぶ', () => {
    // 何を検証するか: E25-01の受け入れ基準として、フッターに3つの導線ボタンが揃って表示されること
    render(<App />)

    const footer = screen.getByRole('contentinfo')
    expect(within(footer).getByRole('button', { name: '自分の投稿' })).toBeInTheDocument()
    expect(within(footer).getByRole('button', { name: 'ランキング' })).toBeInTheDocument()
    expect(within(footer).getByRole('button', { name: 'プライバシーポリシー' })).toBeInTheDocument()
  })
})
