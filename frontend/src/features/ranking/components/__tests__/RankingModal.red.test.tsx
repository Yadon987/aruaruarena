import { fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RankingModal } from '../RankingModal'
import { useRankings } from '../../../../shared/hooks/useRankings'

vi.mock('../../../../shared/hooks/useRankings', () => ({
  useRankings: vi.fn(),
}))

const mockedUseRankings = vi.mocked(useRankings)

const rankings = Array.from({ length: 20 }, (_, i) => ({
  rank: i + 1,
  id: `id-${i + 1}`,
  nickname: `user-${i + 1}`,
  body: `body-${i + 1}`,
  average_score: 90 - i * 0.1,
}))

function setupRanking() {
  mockedUseRankings.mockReturnValue({
    data: { rankings },
    isLoading: false,
    isError: false,
    error: null,
  } as ReturnType<typeof useRankings>)
}

describe('RankingModal RED', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupRanking()
  })

  it('モーダルが開閉できる', () => {
    const onClose = vi.fn()
    const { rerender, queryByRole } = render(
      <RankingModal
        isOpen={false}
        onClose={onClose}
        myPostIds={[]}
        onSelectRankingPost={vi.fn()}
      />
    )

    expect(queryByRole('dialog', { name: 'ランキング' })).not.toBeInTheDocument()

    rerender(
      <RankingModal
        isOpen
        onClose={onClose}
        myPostIds={[]}
        onSelectRankingPost={vi.fn()}
      />
    )
    expect(screen.getByRole('dialog', { name: 'ランキング' })).toBeInTheDocument()

    rerender(
      <RankingModal
        isOpen={false}
        onClose={onClose}
        myPostIds={[]}
        onSelectRankingPost={vi.fn()}
      />
    )
    expect(queryByRole('dialog', { name: 'ランキング' })).not.toBeInTheDocument()
  })

  it('Escキーでモーダルを閉じる', () => {
    const onClose = vi.fn()
    render(
      <RankingModal
        isOpen
        onClose={onClose}
        myPostIds={[]}
        onSelectRankingPost={vi.fn()}
      />
    )

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'ランキング' }), { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('背景クリックでモーダルを閉じる', () => {
    const onClose = vi.fn()
    render(
      <RankingModal
        isOpen
        onClose={onClose}
        myPostIds={[]}
        onSelectRankingPost={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'ランキングモーダル背景' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('閉じる操作後にトリガーボタンへフォーカスを戻す', () => {
    const onClose = vi.fn()
    const triggerRef = createRef<HTMLButtonElement>()

    render(
      <div>
        <button ref={triggerRef} type="button">
          ランキングを開く
        </button>
        <RankingModal
          isOpen
          onClose={onClose}
          triggerRef={triggerRef}
          myPostIds={[]}
          onSelectRankingPost={vi.fn()}
        />
      </div>
    )

    fireEvent.click(screen.getByRole('button', { name: '閉じる' }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(triggerRef.current).toHaveFocus()
  })

  it('フォーカストラップが機能する', () => {
    const onClose = vi.fn()
    render(
      <RankingModal
        isOpen
        onClose={onClose}
        myPostIds={[]}
        onSelectRankingPost={vi.fn()}
      />
    )

    const dialog = screen.getByRole('dialog', { name: 'ランキング' })
    const closeButton = screen.getByRole('button', { name: '閉じる' })

    closeButton.focus()
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(screen.getByRole('button', { name: /^20位 user-20/ })).toHaveFocus()

    const lastItem = screen.getByRole('button', { name: /^20位 user-20/ })
    lastItem.focus()
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(closeButton).toHaveFocus()
  })

  it('RankingSectionを内包してランキング一覧を表示する', () => {
    const onClose = vi.fn()
    render(
      <RankingModal
        isOpen
        onClose={onClose}
        myPostIds={[]}
        onSelectRankingPost={vi.fn()}
      />
    )

    expect(screen.getByRole('region', { name: 'ランキング表示エリア' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^1位 user-1/ })).toBeInTheDocument()
  })
})
