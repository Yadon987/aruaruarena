import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../../App'
import { useRankings } from '../../../shared/hooks/useRankings'

vi.mock('@tanstack/react-query-devtools', () => ({
  ReactQueryDevtools: () => <div data-testid="react-query-devtools" />,
}))

vi.mock('../../../shared/hooks/useRankings', () => ({
  useRankings: vi.fn(),
}))

const mockedUseRankings = vi.mocked(useRankings)

function setupRanking() {
  mockedUseRankings.mockReturnValue({
    data: {
      rankings: [{ rank: 1, id: 'rank-post-1', nickname: 'ランク太郎', body: '本文', average_score: 90.1 }],
      total_count: 1,
    },
    isLoading: false,
    isError: false,
    error: null,
  } as ReturnType<typeof useRankings>)
}

describe('E17 RED: PrivacyPolicyModal RTL', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    setupRanking()
  })

  it('フッターにプライバシーポリシーボタンが表示される', () => {
    // 何を検証するか: トップ画面フッターにモーダル起動ボタンが存在すること
    render(<App />)

    expect(screen.getByRole('button', { name: 'プライバシーポリシー' })).toBeInTheDocument()
  })

  it('プライバシーポリシーボタン押下でモーダルが開く', () => {
    // 何を検証するか: 起動ボタン押下でaria属性を持つダイアログが表示されること
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'プライバシーポリシー' }))

    expect(screen.getByRole('dialog', { name: 'プライバシーポリシー' })).toBeInTheDocument()
  })

  it('閉じるボタンでモーダルを閉じる', () => {
    // 何を検証するか: モーダル内の閉じるボタンでダイアログを閉じられること
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'プライバシーポリシー' }))
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }))

    expect(screen.queryByRole('dialog', { name: 'プライバシーポリシー' })).not.toBeInTheDocument()
  })

  it('Escキーでモーダルを閉じる', () => {
    // 何を検証するか: ダイアログ表示中にEscキーで閉じられること
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'プライバシーポリシー' }))
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'プライバシーポリシー' }), {
      key: 'Escape',
    })

    expect(screen.queryByRole('dialog', { name: 'プライバシーポリシー' })).not.toBeInTheDocument()
  })

  it('閉じた後にトリガーボタンへフォーカスが戻る', () => {
    // 何を検証するか: モーダルを閉じると起動ボタンへフォーカス復帰すること
    render(<App />)

    const trigger = screen.getByRole('button', { name: 'プライバシーポリシー' })
    fireEvent.click(trigger)
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'プライバシーポリシー' }), { key: 'Escape' })

    expect(trigger).toHaveFocus()
  })

  it('先頭要素でShift+Tabすると末尾要素に循環する', () => {
    // 何を検証するか: フォーカストラップで先頭から逆順移動した際に末尾へ循環すること
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'プライバシーポリシー' }))
    const dialog = screen.getByRole('dialog', { name: 'プライバシーポリシー' })
    const closeButton = within(dialog).getByRole('button', { name: '閉じる' })

    closeButton.focus()
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })

    expect(closeButton).toHaveFocus()
  })

  it('末尾要素でTabすると先頭要素に循環する', () => {
    // 何を検証するか: フォーカストラップで末尾から順方向移動した際に先頭へ循環すること
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'プライバシーポリシー' }))
    const dialog = screen.getByRole('dialog', { name: 'プライバシーポリシー' })
    const closeButton = within(dialog).getByRole('button', { name: '閉じる' })

    closeButton.focus()
    fireEvent.keyDown(dialog, { key: 'Tab' })

    expect(closeButton).toHaveFocus()
  })

  it('背景クリックで閉じた後にトリガーボタンへフォーカスが戻る', () => {
    // 何を検証するか: 背景クリックで閉じる操作でも起動ボタンへフォーカス復帰すること
    render(<App />)

    const trigger = screen.getByRole('button', { name: 'プライバシーポリシー' })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('button', { name: 'プライバシーポリシーモーダル背景' }))

    expect(screen.queryByRole('dialog', { name: 'プライバシーポリシー' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('本文セクションが表示されスクロール可能クラスを持つ', () => {
    // 何を検証するか: 利用規約/プライバシーポリシー本文とスクロール用クラスが適用されること
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'プライバシーポリシー' }))

    const dialog = screen.getByRole('dialog', { name: 'プライバシーポリシー' })
    expect(within(dialog).getByRole('heading', { level: 3, name: '利用規約' })).toBeInTheDocument()
    expect(
      within(dialog).getByRole('heading', { level: 3, name: 'プライバシーポリシー' })
    ).toBeInTheDocument()

    const scrollArea = within(dialog).getByTestId('privacy-policy-scroll-area')
    expect(scrollArea).toHaveClass('overflow-y-auto')
  })

  it('自分の投稿一覧モーダルと同時表示されない', () => {
    // 何を検証するか: 複数モーダル競合を避けて常に単一モーダル表示を維持すること
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '自分の投稿一覧' }))
    expect(screen.getByRole('dialog', { name: '自分の投稿' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'プライバシーポリシー' }))

    expect(screen.getByRole('dialog', { name: 'プライバシーポリシー' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: '自分の投稿' })).not.toBeInTheDocument()
  })
})
