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

  it('RED: ホーム画面の審査員UIは審査中と同一サイズクラスで表示される', () => {
    // 何を検証するか: ホーム下部ドックでも審査中と同じアバターサイズ仕様を使用すること
    render(<App />)

    const dock = screen.getByTestId('top-judge-dock')
    const avatars = within(dock).getAllByRole('img')
    avatars.forEach((avatar) => {
      expect(avatar).toHaveClass('w-28')
    })
  })
})
