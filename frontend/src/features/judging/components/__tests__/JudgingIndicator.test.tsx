import { act, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JudgingIndicator } from '../JudgingIndicator'

const useReducedMotionMock = vi.fn(() => false)

vi.mock('../../../../shared/hooks/useReducedMotion', () => ({
  useReducedMotion: () => useReducedMotionMock(),
}))

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion')
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  }
})

describe('JudgingIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useReducedMotionMock.mockReturnValue(false)
  })

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers()
    })
    vi.useRealTimers()
  })

  it('初期状態では最初のフレーズが表示される', () => {
    render(<JudgingIndicator />)
    expect(screen.getByText('投稿を受け付けました ✨')).toBeInTheDocument()
  })

  it('指定時間が経過すると次のフレーズに切り替わる', () => {
    render(<JudgingIndicator />)
    expect(screen.getByText('投稿を受け付けました ✨')).toBeInTheDocument()

    // 1980ms進める
    act(() => {
      vi.advanceTimersByTime(1980)
    })
    expect(screen.getByText('審査員が評価中...')).toBeInTheDocument()

    // さらに1980ms進める
    act(() => {
      vi.advanceTimersByTime(1980)
    })
    expect(screen.getByText('共感度を測定中...')).toBeInTheDocument()
  })

  it('最後のフレーズに到達したらそのまま表示を維持する', () => {
    render(<JudgingIndicator />)

    act(() => {
      vi.advanceTimersByTime(1980 * 3)
    })
    expect(screen.getByText('最終判定を集計中 💡')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1980 * 2)
    })
    expect(screen.getByText('最終判定を集計中 💡')).toBeInTheDocument()
  })

  it('最後のフレーズ到達後は追加のタイマーを消費しない', () => {
    render(<JudgingIndicator />)

    act(() => {
      vi.advanceTimersByTime(1980 * 3)
    })

    expect(vi.getTimerCount()).toBe(1)

    act(() => {
      vi.advanceTimersByTime(1980)
    })

    expect(vi.getTimerCount()).toBe(0)
    expect(screen.getByText('最終判定を集計中 💡')).toBeInTheDocument()
  })

  it('ライブリージョンとして審査中状態を通知できる', () => {
    render(<JudgingIndicator />)

    expect(screen.getByTestId('judging-screen')).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByRole('status', { name: '審査中' })).toBeInTheDocument()
  })

  it('reduced motion が有効でもフレーズは即時に切り替わる', () => {
    useReducedMotionMock.mockReturnValue(true)

    render(<JudgingIndicator />)

    act(() => {
      vi.advanceTimersByTime(1980)
    })

    expect(screen.getByText('審査員が評価中...')).toBeInTheDocument()
  })
})
