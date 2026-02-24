import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

describe('E18 RED: SoundToggle integration', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    setupRanking()
    vi.stubGlobal('__AUDIO_DEBUG__', [])
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('初期表示で音声OFFが表示される', () => {
    // 何を検証するか: 初期状態がミュートであり音声OFFラベルが表示されること
    render(<App />)

    expect(screen.getByRole('button', { name: '音声OFF' })).toBeInTheDocument()
  })

  it('トグル押下でラベルが切り替わる', () => {
    // 何を検証するか: 音声トグル押下でラベルが 音声OFF -> 音声ON に変わること
    render(<App />)

    const toggle = screen.getByRole('button', { name: '音声OFF' })
    expect(toggle).toBeInTheDocument()

    fireEvent.click(toggle)

    expect(screen.getByRole('button', { name: '音声ON' })).toBeInTheDocument()
  })

  it('音声ONに切り替えるとlocalStorageへfalseを保存する', () => {
    // 何を検証するか: ミュート解除時に aruaru_sound_muted=false が保存されること
    render(<App />)

    const toggle = screen.getByRole('button', { name: '音声OFF' })
    fireEvent.click(toggle)

    expect(localStorage.getItem('aruaru_sound_muted')).toBe('false')
  })

  it('初回ユーザー操作前は再生要求が発生しない', () => {
    // 何を検証するか: audioUnlocked=false の間は再生イベントが発生しないこと
    render(<App />)

    const debugEvents = (globalThis as { __AUDIO_DEBUG__?: unknown[] }).__AUDIO_DEBUG__
    expect(Array.isArray(debugEvents)).toBe(true)
    expect(debugEvents).toHaveLength(0)
  })
})
