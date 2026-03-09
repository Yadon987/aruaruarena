import { render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../../App'
import { JUDGE } from '../../../shared/constants/validation'
import { api } from '../../../shared/services/api'
import { fillAndSubmitPostForm } from '../../../test/helpers'

vi.mock('@tanstack/react-query-devtools', () => ({
  ReactQueryDevtools: () => <div data-testid="react-query-devtools" />,
}))

describe('E23-01 RED: 審査中画面のアバター統合', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  async function submitValidPost() {
    await fillAndSubmitPostForm({ nickname: '太郎', body: 'スヌーズ押して二度寝' })

    await waitFor(() => {
      expect(api.posts.create).toHaveBeenCalledTimes(1)
    })
  }

  it('審査中画面に3人のアバター画像が表示される', async () => {
    vi.spyOn(api.posts, 'create').mockResolvedValue({
      id: 'judge-avatar-red-1',
      status: 'judging',
    })
    vi.spyOn(api.posts, 'get').mockResolvedValue({
      id: 'judge-avatar-red-1',
      nickname: '太郎',
      body: 'スヌーズ押して二度寝',
      status: 'judging',
      created_at: '2026-03-04T00:00:00Z',
      judgments: [],
    })

    render(<App />)
    await submitValidPost()

    await screen.findByTestId('top-judge-dock')

    const avatars = screen.getAllByRole('img').filter((image) => {
      return image.getAttribute('alt')?.includes('審査員')
    })
    expect(avatars).toHaveLength(JUDGE.PERSONAS.length)
  })

  it('発話開始後にいずれかのキャッチフレーズが表示される', async () => {
    vi.spyOn(api.posts, 'create').mockResolvedValue({
      id: 'judge-avatar-red-2',
      status: 'judging',
    })
    vi.spyOn(api.posts, 'get').mockResolvedValue({
      id: 'judge-avatar-red-2',
      nickname: '太郎',
      body: '電車で降りる駅を寝過ごす',
      status: 'judging',
      created_at: '2026-03-04T00:00:00Z',
      judgments: [],
    })

    render(<App />)
    await submitValidPost()

    await waitFor(() => {
      const bubble =
        screen.queryByTestId('catchphrase-hiroyuki') ??
        screen.queryByTestId('catchphrase-dewi') ??
        screen.queryByTestId('catchphrase-nakao')
      expect(bubble).not.toBeNull()
    })

    const judgeSlot = await screen.findByTestId('judge-slot-hiroyuki')
    expect(
      within(judgeSlot).getByRole('img', {
        name: /ひろゆき風審査員/,
      })
    ).toBeInTheDocument()
  })
})
