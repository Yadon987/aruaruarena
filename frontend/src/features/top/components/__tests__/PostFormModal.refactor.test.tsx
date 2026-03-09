import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { loadComponent } from '../../../../test/mocks/framerMotion'

const loadPostFormModal = () => loadComponent(() => import('../PostFormModal'))

describe('PostFormModal Refactor', () => {
  it('モーダルオープン時に閉じるボタンへフォーカスする', async () => {
    const { PostFormModal } = await loadPostFormModal()

    render(<PostFormModal isOpen={true} onClose={vi.fn()} onSubmit={vi.fn()} isLoading={false} />)

    expect(screen.getByRole('button', { name: '閉じる' })).toHaveFocus()
  })

  it('Tab でフォーカスが最後から最初へ循環する', async () => {
    const { PostFormModal } = await loadPostFormModal()

    render(<PostFormModal isOpen={true} onClose={vi.fn()} onSubmit={vi.fn()} isLoading={false} />)

    const first = screen.getByRole('button', { name: '閉じる' })
    const last = screen.getByRole('button', { name: '投稿' })
    last.focus()
    fireEvent.keyDown(document, { key: 'Tab' })

    expect(first).toHaveFocus()
  })

  it('Shift+Tab でフォーカスが最初から最後へ循環する', async () => {
    const { PostFormModal } = await loadPostFormModal()

    render(<PostFormModal isOpen={true} onClose={vi.fn()} onSubmit={vi.fn()} isLoading={false} />)

    const first = screen.getByRole('button', { name: '閉じる' })
    const last = screen.getByRole('button', { name: '投稿' })
    first.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })

    expect(last).toHaveFocus()
  })

  it('モーダルクローズ時に入力値を下書きとして通知する', async () => {
    const { PostFormModal } = await loadPostFormModal()
    const onClose = vi.fn()
    const onCloseWithDraft = vi.fn()

    const { rerender } = render(
      <PostFormModal
        isOpen={true}
        onClose={onClose}
        onCloseWithDraft={onCloseWithDraft}
        onSubmit={vi.fn()}
        isLoading={false}
      />
    )

    fireEvent.change(screen.getByLabelText('ニックネーム'), { target: { value: '下書き太郎' } })
    fireEvent.change(screen.getByLabelText('あるある'), { target: { value: '閉じても保持される本文' } })

    rerender(
      <PostFormModal
        isOpen={false}
        onClose={onClose}
        onCloseWithDraft={onCloseWithDraft}
        onSubmit={vi.fn()}
        isLoading={false}
      />
    )

    expect(onCloseWithDraft).toHaveBeenCalledWith({
      nickname: '下書き太郎',
      body: '閉じても保持される本文',
    })
  })

  it('空入力で閉じた場合は下書き通知を行わない', async () => {
    const { PostFormModal } = await loadPostFormModal()
    const onClose = vi.fn()
    const onCloseWithDraft = vi.fn()

    const { rerender } = render(
      <PostFormModal
        isOpen={true}
        onClose={onClose}
        onCloseWithDraft={onCloseWithDraft}
        onSubmit={vi.fn()}
        isLoading={false}
      />
    )

    rerender(
      <PostFormModal
        isOpen={false}
        onClose={onClose}
        onCloseWithDraft={onCloseWithDraft}
        onSubmit={vi.fn()}
        isLoading={false}
      />
    )

    expect(onCloseWithDraft).not.toHaveBeenCalled()
  })
})
