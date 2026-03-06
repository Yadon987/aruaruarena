import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  capturedMotionImgProps,
  loadComponent,
  resetCapturedMotionImgProps,
} from '../../../../test/mocks/framerMotion'

const useJudgeEntranceMock = vi.fn()
const useJudgeSpeechMock = vi.fn()
const useJudgeAvatarStateMock = vi.fn()

vi.mock('../../../../shared/hooks/useJudgeEntrance', () => ({
  useJudgeEntrance: () => useJudgeEntranceMock(),
}))
vi.mock('../../../../shared/hooks/useJudgeSpeech', () => ({
  useJudgeSpeech: (...args: unknown[]) => useJudgeSpeechMock(...args),
}))
vi.mock('../../../../shared/hooks/useJudgeAvatarState', () => ({
  useJudgeAvatarState: (...args: unknown[]) => useJudgeAvatarStateMock(...args),
}))

const loadJudgeAvatars = () => loadComponent(() => import('../JudgeAvatars'))

function setupJudgeAvatarsMocks() {
  useJudgeEntranceMock.mockReturnValue({
    hasEntered: true,
    variants: {
      hiroyuki: {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: 1 },
      },
      dewi: {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: 1 },
      },
      nakao: {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: 1 },
      },
    },
  })
  useJudgeSpeechMock.mockReturnValue({ currentSpeech: 'テスト', speakingJudge: 'dewi' })
  useJudgeAvatarStateMock.mockReturnValue({
    avatarStates: {
      hiroyuki: 'base',
      dewi: 'base',
      nakao: 'base',
    },
  })
}

describe('JudgeAvatars Refactor', () => {
  beforeEach(() => {
    resetCapturedMotionImgProps()
    vi.clearAllMocks()
    setupJudgeAvatarsMocks()
  })

  it('登場完了後はentrance.animateを使用する（静止状態）', async () => {
    const { JudgeAvatars } = await loadJudgeAvatars()
    render(<JudgeAvatars isJudging={true} isPostModalOpen={false} />)

    expect(capturedMotionImgProps.length).toBe(3)
    const nakao = capturedMotionImgProps.find((item) => item.alt === '中尾彬風審査員')
    expect(nakao).toBeDefined()
    expect(nakao?.animate).toEqual({ opacity: 1 })
  })

  it('発話中は対象審査員の吹き出しのみ表示する', async () => {
    const { JudgeAvatars } = await loadJudgeAvatars()
    render(<JudgeAvatars isJudging={true} isPostModalOpen={false} />)

    expect(screen.getByRole('status')).toHaveTextContent('テスト')
  })

  it('currentSpeech が null でも発話中審査員にはフォールバック文字列を表示する', async () => {
    useJudgeSpeechMock.mockReturnValue({ currentSpeech: null, speakingJudge: 'hiroyuki' })
    const { JudgeAvatars } = await loadJudgeAvatars()
    render(<JudgeAvatars isJudging={true} isPostModalOpen={false} />)

    expect(screen.getByRole('status')).toHaveTextContent('...')
  })
})
