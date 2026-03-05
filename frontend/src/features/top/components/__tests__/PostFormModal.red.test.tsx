import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadComponent } from '../../../../test/mocks/framerMotion'

const loadPostFormModal = () => loadComponent(() => import('../PostFormModal'))

describe('E24-06 RED: PostFormModal', () => {
  const mockOnClose = vi.fn()
  const mockOnSubmit = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('isOpen=true でモーダルが表示される', async () => {
    // 何を検証するか: FR-04 - 投稿フォームがモーダルとして表示されること
    const { PostFormModal } = await loadPostFormModal()

    render(
      <PostFormModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        isLoading={false}
      />
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('form', { name: '投稿フォーム' })).toBeInTheDocument()
  })

  it('isOpen=false でモーダルが非表示', async () => {
    // 何を検証するか: モーダルが閉じているときは表示されないこと
    const { PostFormModal } = await loadPostFormModal()

    render(
      <PostFormModal
        isOpen={false}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        isLoading={false}
      />
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Esc キーでモーダルが閉じる', async () => {
    // 何を検証するか: キーボード操作でモーダルを閉じられること
    const { PostFormModal } = await loadPostFormModal()

    render(
      <PostFormModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        isLoading={false}
      />
    )

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('背景クリックでモーダルが閉じる', async () => {
    // 何を検証するか: オーバーレイ背景をクリックでモーダルを閉じられること
    const { PostFormModal } = await loadPostFormModal()

    render(
      <PostFormModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        isLoading={false}
      />
    )

    const overlay = screen.getByTestId('modal-overlay')
    fireEvent.click(overlay)
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('フォーム送信で onSubmit が呼ばれる', async () => {
    // 何を検証するか: 投稿ボタン押下でonSubmitコールバックが呼ばれること
    const { PostFormModal } = await loadPostFormModal()

    render(
      <PostFormModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        isLoading={false}
      />
    )

    fireEvent.change(screen.getByLabelText('ニックネーム'), {
      target: { value: 'テストユーザー' },
    })
    fireEvent.change(screen.getByLabelText('あるある'), {
      target: { value: 'テストあるある' },
    })
    fireEvent.click(screen.getByRole('button', { name: '投稿' }))

    expect(mockOnSubmit).toHaveBeenCalledWith({
      nickname: 'テストユーザー',
      body: 'テストあるある',
    })
  })

  it('背景が bg-black/60 で表示される', async () => {
    // 何を検証するか: FR-04 - 背景が半透明の黒で表示されること
    const { PostFormModal } = await loadPostFormModal()

    render(
      <PostFormModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        isLoading={false}
      />
    )

    const overlay = screen.getByTestId('modal-overlay')
    expect(overlay).toHaveClass('bg-black/60')
  })

  it('isLoading=true で投稿ボタンが無効化される', async () => {
    // 何を検証するか: ローディング中は二重投稿を防ぐためボタンを無効化すること
    const { PostFormModal } = await loadPostFormModal()

    render(
      <PostFormModal isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} isLoading={true} />
    )

    expect(screen.getByRole('button', { name: /投稿/ })).toBeDisabled()
  })
})
