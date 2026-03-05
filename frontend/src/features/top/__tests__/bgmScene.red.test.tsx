import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../../App'
import { useRankings } from '../../../shared/hooks/useRankings'
import { api } from '../../../shared/services/api'
import { mockRankings } from '../../../test/appTestHelpers'

vi.mock('@tanstack/react-query-devtools', () => ({
  ReactQueryDevtools: () => <div data-testid="react-query-devtools" />,
}))

vi.mock('../../../shared/hooks/useRankings', () => ({
  useRankings: vi.fn(),
}))

const mockedUseRankings = vi.mocked(useRankings)

type AudioDebugEvent = { type: string; scene?: string; id?: string }

function getAudioDebugEvents(): AudioDebugEvent[] {
  return (globalThis as { __AUDIO_DEBUG__?: AudioDebugEvent[] }).__AUDIO_DEBUG__ ?? []
}

function clearAudioDebugEvents() {
  const debugEvents = getAudioDebugEvents()
  debugEvents.splice(0, debugEvents.length)
}

function setupRanking() {
  mockRankings([
    {
      rank: 1,
      id: 'rank-post-1',
      nickname: 'ランク太郎',
      body: '本文',
      average_score: 90.1,
    },
  ])
}

async function enableSound() {
  fireEvent.click(screen.getByRole('button', { name: '音声OFF' }))
  await waitFor(() => {
    expect(screen.getByRole('button', { name: '音声ON' })).toBeInTheDocument()
  })
}

async function openRankingResultModal(postDetail: Awaited<ReturnType<typeof api.posts.get>>) {
  vi.spyOn(api.posts, 'get').mockResolvedValue(postDetail)

  fireEvent.click(screen.getByTestId('ranking-item'))

  await waitFor(() => {
    expect(screen.getByRole('dialog', { name: '審査結果モーダル' })).toBeInTheDocument()
  })
}

describe('E18-01 RED: BGM scene integration', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    vi.stubGlobal('__AUDIO_DEBUG__', [])
    setupRanking()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    mockedUseRankings.mockReset()
  })

  it('結果モーダル表示時にsuccess BGMとSEを同時に再生する', async () => {
    // 何を検証するか: scored結果モーダル表示で success BGM と se_result_open が同時に発火すること
    render(<App />)
    await enableSound()
    clearAudioDebugEvents()

    await openRankingResultModal({
      id: 'rank-post-1',
      nickname: '成功太郎',
      body: '成功本文',
      status: 'scored',
      created_at: '2026-03-03T00:00:00Z',
      average_score: 95.4,
      rank: 1,
      total_count: 20,
      judgments: [],
    })

    await waitFor(() => {
      expect(getAudioDebugEvents()).toEqual(
        expect.arrayContaining([
          { type: 'bgm', scene: 'success' },
          { type: 'se', id: 'se_result_open' },
        ])
      )
    })
  })

  it('結果モーダル表示時にfailed BGMとSEを同時に再生する', async () => {
    // 何を検証するか: failed結果モーダル表示で failed BGM と se_result_open が同時に発火すること
    render(<App />)
    await enableSound()
    clearAudioDebugEvents()

    await openRankingResultModal({
      id: 'rank-post-1',
      nickname: '失敗太郎',
      body: '失敗本文',
      status: 'failed',
      created_at: '2026-03-03T00:00:00Z',
      judgments: [],
    })

    await waitFor(() => {
      expect(getAudioDebugEvents()).toEqual(
        expect.arrayContaining([
          { type: 'bgm', scene: 'failed' },
          { type: 'se', id: 'se_result_open' },
        ])
      )
    })
  })

  it('結果モーダルを閉じるとtop BGMを再開する', async () => {
    // 何を検証するか: 結果モーダルを閉じた後にトップ画面BGMが再度再生されること
    render(<App />)
    await enableSound()

    await openRankingResultModal({
      id: 'rank-post-1',
      nickname: '成功太郎',
      body: '成功本文',
      status: 'scored',
      created_at: '2026-03-03T00:00:00Z',
      average_score: 95.4,
      rank: 1,
      total_count: 20,
      judgments: [],
    })

    clearAudioDebugEvents()
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }))

    await waitFor(() => {
      const topEvents = getAudioDebugEvents().filter(
        (event) => event.type === 'bgm' && event.scene === 'top'
      )
      expect(topEvents).toHaveLength(1)
    })
  })

  it('投稿ボタン押下でse_submitを再生する', async () => {
    // 何を検証するか: 投稿送信時に se_submit の効果音が再生されること
    vi.spyOn(api.posts, 'create').mockResolvedValue({
      id: 'submit-post-id',
      status: 'judging',
    })
    vi.spyOn(api.posts, 'get').mockImplementation(
      // 意図的に未解決のままにして審査中画面を維持する。
      () => new Promise(() => {})
    )

    render(<App />)
    await enableSound()
    clearAudioDebugEvents()

    fireEvent.click(screen.getByRole('button', { name: '投稿する' }))
    await waitFor(() => screen.getByRole('dialog'))
    fireEvent.change(screen.getByLabelText('ニックネーム'), {
      target: { value: '投稿太郎' },
    })
    fireEvent.change(screen.getByLabelText('あるある'), {
      target: { value: 'これは投稿時効果音のREDテスト本文です' },
    })
    fireEvent.click(screen.getByRole('button', { name: '投稿' }))

    await waitFor(() => {
      expect(api.posts.create).toHaveBeenCalled()
    })

    expect(getAudioDebugEvents()).toContainEqual({
      type: 'se',
      id: 'se_submit',
    })
  })

  it('再審査ボタン押下でse_retryを再生する', async () => {
    // 何を検証するか: 結果モーダルの再審査ボタン押下時に se_retry が再生されること
    vi.spyOn(api.posts, 'rejudge').mockResolvedValue({
      id: 'rank-post-1',
      status: 'judging',
    })

    render(<App />)
    await enableSound()
    clearAudioDebugEvents()

    await openRankingResultModal({
      id: 'rank-post-1',
      nickname: '再審査太郎',
      body: '再審査本文',
      status: 'failed',
      created_at: '2026-03-03T00:00:00Z',
      judgments: [
        {
          persona: 'hiroyuki',
          total_score: 20,
          empathy: 4,
          humor: 4,
          brevity: 4,
          originality: 4,
          expression: 4,
          comment: '失敗',
          success: false,
        },
      ],
    })

    clearAudioDebugEvents()
    fireEvent.click(screen.getByRole('button', { name: '再審査する' }))

    await waitFor(() => {
      expect(api.posts.rejudge).toHaveBeenCalled()
    })

    expect(getAudioDebugEvents()).toContainEqual({
      type: 'se',
      id: 'se_retry',
    })
  })
})
