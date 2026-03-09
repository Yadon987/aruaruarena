import { fireEvent, render, screen, within } from '@testing-library/react'
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

  it('画面右上には音声切り替えのみ表示し、「投稿する」はメイン導線に表示される', () => {
    // 何を検証するか: 右上は補助操作のみとし、投稿導線は中央のメインエリアに配置されること
    render(<App />)

    const actionControls = screen.getByTestId('top-action-controls')
    const soundButton = within(actionControls).getByRole('button', { name: /音声/ })
    const postButton = screen.getByRole('button', { name: '投稿する' })

    expect(actionControls).toHaveClass('fixed')
    expect(within(actionControls).queryByRole('button', { name: '投稿する' })).not.toBeInTheDocument()
    expect(postButton).toBeInTheDocument()
    expect(soundButton).toBeInTheDocument()
    expect(postButton).toHaveClass('neon-button-base')
    expect(soundButton).toHaveClass('neon-button-base')
  })

  it('フッターは全サイズで「ランキング」「その他」の2ボタン構成になる', () => {
    // 何を検証するか: 主要導線を2ボタンへ集約し、補助導線は「その他」に統合されること
    render(<App />)

    const footer = screen.getByRole('contentinfo')
    expect(footer).toHaveClass('flex-nowrap')
    const rankingButton = within(footer).getByRole('button', { name: 'ランキング' })
    const otherButton = within(footer).getByRole('button', { name: 'その他を開く' })

    expect(rankingButton).toBeInTheDocument()
    expect(otherButton).toBeInTheDocument()
    expect(rankingButton).toHaveClass('neon-button-base')
    expect(otherButton).toHaveClass('neon-button-base')
  })

  it('「その他」内の問い合わせ押下でフォームURLを新規タブで開く', () => {
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'その他を開く' }))
    const contactButton = screen.getByRole('button', { name: '問い合わせ（新しいタブで開く）' })
    fireEvent.click(contactButton)

    expect(windowOpenSpy).toHaveBeenCalledWith(
      'https://forms.gle/zLN3j3YF87qdULXB9',
      '_blank',
      'noopener,noreferrer'
    )
    windowOpenSpy.mockRestore()
  })
})
