import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
    localStorage.clear()
    vi.unstubAllGlobals()
    originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
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

  it('右下固定でランキングとその他の2アクションを表示する', () => {
    // 何を検証するか: 画面幅に関わらず補助導線が右下のアイコンボタンで統一されること
    render(<App />)

    expect(screen.getByRole('button', { name: 'ランキング' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'その他を開く' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '過去の投稿' })).not.toBeInTheDocument()
  })

  it('「その他」押下時に設定の3導線が表示される', () => {
    // 何を検証するか: 補助導線が「その他」メニューに集約されること
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'その他を開く' }))

    expect(screen.getByRole('dialog', { name: '設定' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '過去の投稿' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'プライバシーポリシー' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '問い合わせ（新しいタブで開く）' })
    ).toBeInTheDocument()
  })

  it('初回表示時はオンボーディングを先に表示し、閉じた後に音声確認を表示する', async () => {
    vi.stubGlobal('__SHOW_ONBOARDING_MODAL_IN_TEST__', true)
    vi.stubGlobal('__SHOW_AUDIO_CONSENT_MODAL_IN_TEST__', true)

    render(<App />)

    expect(screen.getByRole('dialog', { name: '遊び方ガイド' })).toBeInTheDocument()
    expect(
      screen.queryByRole('alertdialog', { name: '音声を再生しますか？' })
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'はじめる' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '遊び方ガイド' })).not.toBeInTheDocument()
      expect(screen.getByRole('alertdialog', { name: '音声を再生しますか？' })).toBeInTheDocument()
      expect(localStorage.getItem('aruaru_onboarding_completed')).toBe('true')
    })
  })

  it('既読済みでも「その他」から遊び方を再表示できる', () => {
    localStorage.setItem('aruaru_onboarding_completed', 'true')

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'その他を開く' }))
    fireEvent.click(screen.getByRole('button', { name: '遊び方を見る' }))

    expect(screen.queryByRole('dialog', { name: '設定' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: '遊び方ガイド' })).toBeInTheDocument()
    expect(localStorage.getItem('aruaru_onboarding_completed')).toBe('true')
  })

  it('ランキングボタンを再度押すとランキングモーダルを閉じる', () => {
    // 何を検証するか: 同じトリガーの再押下でモーダルを閉じられること
    render(<App />)

    const rankingButton = screen.getByRole('button', { name: 'ランキング' })
    fireEvent.click(rankingButton)
    expect(screen.getByRole('dialog', { name: 'ランキング' })).toBeInTheDocument()

    fireEvent.click(rankingButton)
    expect(screen.queryByRole('dialog', { name: 'ランキング' })).not.toBeInTheDocument()
  })

  it('その他ボタンを再度押すと設定を閉じる', () => {
    // 何を検証するか: 同じトリガーの再押下で設定を閉じられること
    render(<App />)

    const otherButton = screen.getByRole('button', { name: 'その他を開く' })
    fireEvent.click(otherButton)
    expect(screen.getByRole('dialog', { name: '設定' })).toBeInTheDocument()

    fireEvent.click(otherButton)
    expect(screen.queryByRole('dialog', { name: '設定' })).not.toBeInTheDocument()
  })

  it('自分の投稿モーダルは外側クリックで閉じる', () => {
    // 何を検証するか: App直下モーダルでも外側クリック閉鎖の統一仕様を満たすこと
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'その他を開く' }))
    fireEvent.click(screen.getByRole('button', { name: '過去の投稿' }))
    const dialog = screen.getByRole('dialog', { name: '自分の投稿' })
    expect(dialog).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '自分の投稿を閉じる' }))

    expect(screen.queryByRole('dialog', { name: '自分の投稿' })).not.toBeInTheDocument()
  })
})
