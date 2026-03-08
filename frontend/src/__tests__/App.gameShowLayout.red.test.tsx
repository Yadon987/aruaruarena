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

  it('トップ画面にヘッダー領域は表示されない', () => {
    // 何を検証するか: ヘッダー廃止後もトップ画面にbanner領域が残らないこと
    render(<App />)

    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
  })

  it('画面右上に「投稿する」「音声切り替え」が並ぶ', () => {
    // 何を検証するか: E25-01の受け入れ基準として、画面右上の操作領域に2つのボタンが横並びで配置されること
    render(<App />)

    const actionControls = screen.getByTestId('top-action-controls')
    const postButton = within(actionControls).getByRole('button', { name: '投稿する' })
    const soundButton = within(actionControls).getByRole('button', { name: /音声/ })

    expect(actionControls).toHaveClass('fixed')
    expect(postButton).toBeInTheDocument()
    expect(soundButton).toBeInTheDocument()
    expect(postButton).toHaveClass('neon-button-base')
    expect(soundButton).toHaveClass('neon-button-base')
  })

  it('フッターに「過去の投稿」「ランキング」「プライバシーポリシー」「問い合わせ」が並ぶ', () => {
    // 何を検証するか: E25-01の受け入れ基準として、フッターに4つの導線ボタンが揃って表示されること
    render(<App />)

    const footer = screen.getByRole('contentinfo')
    expect(footer).toHaveClass('flex-nowrap')
    const myPostsButton = within(footer).getByRole('button', { name: '過去の投稿' })
    const rankingButton = within(footer).getByRole('button', { name: 'ランキング' })
    const privacyButton = within(footer).getByRole('button', { name: 'プライバシーポリシー' })
    const contactButton = within(footer).getByRole('button', { name: '問い合わせ（新しいタブで開く）' })

    expect(myPostsButton).toBeInTheDocument()
    expect(rankingButton).toBeInTheDocument()
    expect(privacyButton).toBeInTheDocument()
    expect(contactButton).toBeInTheDocument()
    expect(myPostsButton).toHaveClass('neon-button-base')
    expect(myPostsButton).toHaveClass('neon-button-compact-mobile')
    expect(rankingButton).toHaveClass('neon-button-base')
    expect(rankingButton).toHaveClass('neon-button-compact-mobile')
    expect(privacyButton).toHaveClass('neon-button-base')
    expect(privacyButton).toHaveClass('neon-button-compact-mobile')
    expect(contactButton).toHaveClass('neon-button-base')
    expect(contactButton).toHaveClass('neon-button-compact-mobile')
  })

  it('問い合わせボタン押下でフォームURLを新規タブで開く', () => {
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<App />)

    const footer = screen.getByRole('contentinfo')
    const contactButton = within(footer).getByRole('button', { name: '問い合わせ（新しいタブで開く）' })
    contactButton.click()

    expect(windowOpenSpy).toHaveBeenCalledWith(
      'https://forms.gle/zLN3j3YF87qdULXB9',
      '_blank',
      'noopener,noreferrer'
    )
    windowOpenSpy.mockRestore()
  })
})
