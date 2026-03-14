import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JudgingIndicator } from '../JudgingIndicator'

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion')
  return {
    ...actual,
    AnimatePresence: ({ children }: any) => <>{children}</>,
  }
})

describe('JudgingIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
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

    // さらに2500ms進める
    act(() => {
      vi.advanceTimersByTime(1980)
    })
    expect(screen.getByText('共感度を測定中...')).toBeInTheDocument()
  })
})
