import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
    vi.useFakeTimers()
    resetCapturedMotionImgProps()
    vi.clearAllMocks()
    setupJudgeAvatarsMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
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

    await act(async () => {
      vi.advanceTimersByTime(2500)
    })
    expect(screen.getByTestId('catchphrase-dewi')).toHaveTextContent('テスト')

    const dewiAvatar = screen.getByAltText('デヴィ夫人風審査員')
    const hiroyukiAvatar = screen.getByAltText('ひろゆき風審査員')
    const nakaoAvatar = screen.getByAltText('中尾彬風審査員')

    expect(dewiAvatar.parentElement).toHaveClass('judge-avatar-speaking-breath')
    expect(hiroyukiAvatar.parentElement).not.toHaveClass('judge-avatar-speaking-breath')
    expect(nakaoAvatar.parentElement).not.toHaveClass('judge-avatar-speaking-breath')
  })

  it('ホーム待機モードでも話者未設定時は呼吸アニメーションを適用しない', async () => {
    useJudgeSpeechMock.mockReturnValue({ currentSpeech: null, speakingJudge: null })
    const { JudgeAvatars } = await loadJudgeAvatars()
    render(
      <JudgeAvatars
        isJudging={false}
        isPostModalOpen={false}
        enableIdleBehavior={true}
        judgingPhase="complete"
      />
    )

    const hiroyukiAvatar = screen.getByAltText('ひろゆき風審査員')
    const dewiAvatar = screen.getByAltText('デヴィ夫人風審査員')
    const nakaoAvatar = screen.getByAltText('中尾彬風審査員')

    expect(hiroyukiAvatar.parentElement).not.toHaveClass('judge-avatar-speaking-breath')
    expect(dewiAvatar.parentElement).not.toHaveClass('judge-avatar-speaking-breath')
    expect(nakaoAvatar.parentElement).not.toHaveClass('judge-avatar-speaking-breath')
  })

  it('currentSpeech が null でも発話中審査員にはフォールバック文字列を表示する', async () => {
    useJudgeSpeechMock.mockReturnValue({ currentSpeech: null, speakingJudge: 'hiroyuki' })
    const { JudgeAvatars } = await loadJudgeAvatars()
    render(<JudgeAvatars isJudging={true} isPostModalOpen={false} judgingPhase="speaking" />)

    await act(async () => {
      vi.advanceTimersByTime(2500)
    })
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
    expect(screen.getAllByText('00')).toHaveLength(3)
  })

  it('judgingPhase未指定かつisJudging=falseではcomplete相当で吹き出しを表示しない', async () => {
    // 何を検証するか: フェーズ自動解決でトップ画面はcomplete扱いになること
    const { JudgeAvatars } = await loadJudgeAvatars()
    render(<JudgeAvatars isJudging={false} isPostModalOpen={false} />)

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('judge-desk-score')).toHaveLength(3)
  })

  it('ホーム表示でもアバターサイズは共通仕様を維持する', async () => {
    const { JudgeAvatars } = await loadJudgeAvatars()
    render(
      <JudgeAvatars
        isJudging={false}
        isPostModalOpen={false}
        judgingPhase="complete"
      />
    )

    // 何を検証するか: 画面モードに依存せずアバターサイズが共通化されること
    const avatars = screen.getAllByRole('img')
    expect(avatars.length).toBe(3)
    avatars.forEach((avatar) => {
      expect(avatar).toHaveStyle({ width: 'var(--judge-avatar-width)' })
    })
  })

  it('ホーム相当でも審査中と同一のアバターサイズクラスになる', async () => {
    // 何を検証するか: 画面差分を配置のみにし、サイズ仕様を共通化できていること
    const { JudgeAvatars } = await loadJudgeAvatars()

    const { rerender } = render(
      <JudgeAvatars isJudging={false} isPostModalOpen={false} judgingPhase="complete" />
    )

    const homeAvatars = screen.getAllByRole('img')
    homeAvatars.forEach((avatar) => {
      expect(avatar).toHaveStyle({ width: 'var(--judge-avatar-width)' })
    })

    rerender(<JudgeAvatars isJudging={true} isPostModalOpen={false} judgingPhase="speaking" />)
    const judgingAvatars = screen.getAllByRole('img')
    judgingAvatars.forEach((avatar) => {
      expect(avatar).toHaveStyle({ width: 'var(--judge-avatar-width)' })
    })
  })

  it('isJudging指定有無でアバターサイズが不変である', async () => {
    // 何を検証するか: ホーム/審査中でアバターサイズが不変であること
    const { JudgeAvatars } = await loadJudgeAvatars()

    const { rerender } = render(
      <JudgeAvatars isJudging={false} isPostModalOpen={false} judgingPhase="complete" />
    )
    const defaultAvatars = screen.getAllByRole('img')
    defaultAvatars.forEach((avatar) => {
      expect(avatar).toHaveStyle({ width: 'var(--judge-avatar-width)' })
    })

    rerender(
      <JudgeAvatars
        isJudging={true}
        isPostModalOpen={false}
        judgingPhase="speaking"
      />
    )
    const compactAvatars = screen.getAllByRole('img')
    compactAvatars.forEach((avatar) => {
      expect(avatar).toHaveStyle({ width: 'var(--judge-avatar-width)' })
    })
  })

  it('judgeとpersonaが混在するjudgmentsでも審査員ごとに正しくマッピングする', async () => {
    // 何を検証するか: judge/persona混在データを取り込んでも表示崩れしないこと
    const { JudgeAvatars } = await loadJudgeAvatars()
    render(
      <JudgeAvatars
        isJudging={false}
        isPostModalOpen={false}
        judgingPhase="complete"
        judgments={[
          { judge: 'nakao', score: 81, success: true },
          { persona: 'hiroyuki', score: 88, success: true },
          { judge: 'dewi', score: 93, success: true },
        ]}
      />
    )

    expect(screen.getByLabelText('中尾彬審査員のスコア: 81点')).toBeInTheDocument()
    expect(screen.getByLabelText('ひろゆき審査員のスコア: 88点')).toBeInTheDocument()
    expect(screen.getByLabelText('デヴィ婦人審査員のスコア: 93点')).toBeInTheDocument()
  })

  it('各審査員スロットに名札を表示する', async () => {
    const { JudgeAvatars } = await loadJudgeAvatars()
    render(<JudgeAvatars isJudging={false} isPostModalOpen={false} />)

    expect(screen.getByTestId('judge-seat-nameplate-nakao')).toHaveTextContent('大物俳優N')
    expect(screen.getByTestId('judge-seat-nameplate-hiroyuki')).toHaveTextContent('論破王H')
    expect(screen.getByTestId('judge-seat-nameplate-dewi')).toHaveTextContent('富豪D夫人')
  })
})
