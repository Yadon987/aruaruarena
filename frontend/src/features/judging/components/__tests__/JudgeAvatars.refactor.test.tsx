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
  }, 15000)

  it('発話中は対象審査員の吹き出しのみ表示する', async () => {
    const { JudgeAvatars } = await loadJudgeAvatars()
    render(<JudgeAvatars isJudging={true} isPostModalOpen={false} judgingPhase="speaking" />)

    expect(screen.getByTestId('catchphrase-dewi')).toHaveTextContent('テスト')
  })

  it('currentSpeech が null でも発話中審査員にはフォールバック文字列を表示する', async () => {
    useJudgeSpeechMock.mockReturnValue({ currentSpeech: null, speakingJudge: 'hiroyuki' })
    const { JudgeAvatars } = await loadJudgeAvatars()
    render(<JudgeAvatars isJudging={true} isPostModalOpen={false} judgingPhase="speaking" />)

    expect(screen.getByRole('status')).toHaveTextContent('...')
  })

  it('scoringフェーズかつjudgmentsが空配列でもスコアパネルを表示する', async () => {
    const { JudgeAvatars } = await loadJudgeAvatars()
    render(
      <JudgeAvatars
        isJudging={false}
        isPostModalOpen={false}
        judgingPhase="scoring"
        judgments={[]}
      />
    )

    // 新しい構造では各スロット内にスコアパネルが存在
    expect(screen.getAllByTestId('judge-desk-score')).toHaveLength(3)
  })

  it('judgingPhase未指定時でもスコアパネルをプレースホルダー表示する', async () => {
    const { JudgeAvatars } = await loadJudgeAvatars()
    render(<JudgeAvatars isJudging={true} isPostModalOpen={false} />)

    expect(screen.getByTestId('judge-avatars-container')).toBeInTheDocument()
    // 新しい構造では各スロット内にスコアパネルが存在
    expect(screen.getAllByTestId('judge-desk-score')).toHaveLength(3)
    expect(screen.getAllByText('---')).toHaveLength(3)
  })

  it('compactAvatarSize=true の場合はアバターサイズが縮小される', async () => {
    const { JudgeAvatars } = await loadJudgeAvatars()
    render(
      <JudgeAvatars
        isJudging={false}
        isPostModalOpen={false}
        compactAvatarSize={true}
        judgingPhase="complete"
      />
    )

    // 新しい構造ではアバターのサイズクラスを確認
    const avatars = screen.getAllByRole('img')
    expect(avatars.length).toBe(3)
    avatars.forEach((avatar) => {
      expect(avatar).toHaveClass('w-24')
      expect(avatar.className).toMatch(/sm:w-28/)
      expect(avatar.className).toMatch(/md:w-40/)
    })
  })

  it('RED: ホーム相当でも審査中と同一のアバターサイズクラスになる', async () => {
    // 何を検証するか: 画面差分を配置のみにし、サイズ仕様を共通化できていること
    const { JudgeAvatars } = await loadJudgeAvatars()

    const { rerender } = render(
      <JudgeAvatars
        isJudging={false}
        isPostModalOpen={false}
        compactAvatarSize={true}
        judgingPhase="complete"
      />
    )

    const homeAvatars = screen.getAllByRole('img')
    homeAvatars.forEach((avatar) => {
      expect(avatar).toHaveClass('w-28')
    })

    rerender(<JudgeAvatars isJudging={true} isPostModalOpen={false} judgingPhase="speaking" />)
    const judgingAvatars = screen.getAllByRole('img')
    judgingAvatars.forEach((avatar) => {
      expect(avatar).toHaveClass('w-28')
    })
  })

  it('RED: compact系props指定有無でアバターサイズが不変である', async () => {
    // 何を検証するか: compactAvatarSize/compactBottomSpacingに依存しない単一サイズ仕様であること
    const { JudgeAvatars } = await loadJudgeAvatars()

    const { rerender } = render(
      <JudgeAvatars isJudging={false} isPostModalOpen={false} judgingPhase="complete" />
    )
    const defaultAvatars = screen.getAllByRole('img')
    defaultAvatars.forEach((avatar) => {
      expect(avatar).toHaveClass('w-28')
    })

    rerender(
      <JudgeAvatars
        isJudging={false}
        isPostModalOpen={false}
        compactAvatarSize={true}
        compactBottomSpacing={true}
        judgingPhase="complete"
      />
    )
    const compactAvatars = screen.getAllByRole('img')
    compactAvatars.forEach((avatar) => {
      expect(avatar).toHaveClass('w-28')
    })
  })
})
