import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

describe('App Game Show Layout Refactor', () => {
  let originalScrollIntoView: typeof window.HTMLElement.prototype.scrollIntoView

  beforeEach(() => {
    vi.clearAllMocks()
    originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView
  })

  afterEach(() => {
    vi.restoreAllMocks()
    window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView
  })

  it('ランキングボタン押下でランキングセクションへスクロールする', () => {
    // 何を検証するか: 同一画面内導線としてランキングボタンがscrollIntoViewを呼ぶこと
    const scrollIntoViewMock = vi.fn()
    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: scrollIntoViewMock,
    })

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'ランキング' }))

    expect(screen.getByRole('dialog', { name: 'ランキング' })).toBeInTheDocument()
  })

  it('ホーム画面の審査員UIは審査中と同一サイズクラスで表示される', () => {
    // 何を検証するか: ホーム下部ドックでも審査中と同じアバターサイズ仕様を使用すること
    render(<App />)

    const dock = screen.getByTestId('top-judge-dock')
    const avatars = within(dock).getAllByRole('img')
    expect(avatars.length).toBeGreaterThan(0)
    avatars.forEach((avatar) => {
      expect(avatar).toHaveStyle({ width: 'var(--judge-avatar-width)' })
    })
  })

  it('フッター常時表示が全サイズでランキングとその他の2アクションになる', () => {
    // 何を検証するか: 画面幅に関わらずフッター導線が2ボタンで統一されること
    render(<App />)

    const footer = screen.getByRole('contentinfo')
    expect(within(footer).getByRole('button', { name: 'ランキング' })).toBeInTheDocument()
    expect(within(footer).getByRole('button', { name: 'その他を開く' })).toBeInTheDocument()
    expect(within(footer).queryByRole('button', { name: '過去の投稿' })).not.toBeInTheDocument()
  })

  it('「その他」押下時に補助メニューの3導線が表示される', () => {
    // 何を検証するか: 補助導線が「その他」メニューに集約されること
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'その他を開く' }))

    expect(screen.getByRole('dialog', { name: '補助メニュー' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '過去の投稿' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'プライバシーポリシー' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '問い合わせ（新しいタブで開く）' })).toBeInTheDocument()
  })
  it('自分の投稿モーダルは外側クリックで閉じる', () => {
    // 何を検証するか: App直下モーダルでも外側クリック閉鎖の統一仕様を満たすこと
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'その他を開く' }))
    fireEvent.click(screen.getByRole('button', { name: '過去の投稿' }))
    const dialog = screen.getByRole('dialog', { name: '自分の投稿' })
    expect(dialog).toBeInTheDocument()

    fireEvent.click(dialog)

    expect(screen.queryByRole('dialog', { name: '自分の投稿' })).not.toBeInTheDocument()
  })
})
