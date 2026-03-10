import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
      rankings: [
        {
          rank: 1,
          id: 'rank-post-1',
          nickname: 'ランク太郎',
          body: '本文',
          average_score: 90.1,
        },
      ],
      total_count: 1,
    },
    isLoading: false,
    isError: false,
    error: null,
  } as ReturnType<typeof useRankings>)
}

describe('E18 RED: Sound settings integration', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    setupRanking()
    vi.stubGlobal('__AUDIO_DEBUG__', [])
    vi.stubGlobal('__SHOW_AUDIO_CONSENT_MODAL_IN_TEST__', true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('初回表示で音声同意モーダルが表示される', () => {
    // 何を検証するか: 初回アクセス時に同意モーダルが表示されること
    render(<App />)

    expect(screen.getByRole('alertdialog', { name: '音声を再生しますか？' })).toBeInTheDocument()
  })

  it('同意で初期音量0.6とconsent=trueを保存する', async () => {
    // 何を検証するか: 「はい」選択で音量0.6と同意状態が保存されること
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'はい' }))

    await waitFor(() => {
      expect(localStorage.getItem('aruaru_sound_consent')).toBe('true')
      expect(localStorage.getItem('aruaru_sound_volume')).toBe('0.6')
    })
  })

  it('拒否で音量0を保存する', async () => {
    // 何を検証するか: 「いいえ」選択で音量0が保存されること
    // 注: aruaru_sound_consent は「同意したか」ではなく「初回モーダルに回答済みか」を示す。
    // TODO: 将来的にキー名を aruaru_sound_modal_answered へリネームする。
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'いいえ' }))

    await waitFor(() => {
      expect(localStorage.getItem('aruaru_sound_consent')).toBe('true')
      expect(localStorage.getItem('aruaru_sound_volume')).toBe('0')
    })
  })

  it('音量0ではミュートアイコンを表示する', async () => {
    // 何を検証するか: ボリューム0設定時にミュートアイコンへ切り替わること
    localStorage.setItem('aruaru_sound_consent', 'true')
    localStorage.setItem('aruaru_sound_volume', '0')

    render(<App />)

    const button = screen.getByRole('button', { name: '音声設定' })
    expect(button).toHaveTextContent('🔇')
  })

  it('設定パネルでスライダー操作すると保存値が更新される', async () => {
    // 何を検証するか: スライダー変更が localStorage とUIへ即時反映されること
    localStorage.setItem('aruaru_sound_consent', 'true')
    localStorage.setItem('aruaru_sound_volume', '0.5')

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '音声設定' }))
    const slider = await screen.findByRole('slider', { name: '音量' })
    fireEvent.change(slider, { target: { value: '20' } })

    await waitFor(() => {
      expect(localStorage.getItem('aruaru_sound_volume')).toBe('0.2')
      expect(screen.getByText('20%')).toBeInTheDocument()
    })
  })

  it('音声ボタンを再度押すと設定パネルを閉じる', async () => {
    // 何を検証するか: 音声ボタンの2回目押下でパネルが閉じること
    localStorage.setItem('aruaru_sound_consent', 'true')
    localStorage.setItem('aruaru_sound_volume', '0.5')

    render(<App />)

    const trigger = screen.getByRole('button', { name: '音声設定' })
    fireEvent.click(trigger)
    expect(await screen.findByRole('dialog', { name: '音声設定パネル' })).toBeInTheDocument()

    fireEvent.click(trigger)
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '音声設定パネル' })).not.toBeInTheDocument()
    })
  })
})
