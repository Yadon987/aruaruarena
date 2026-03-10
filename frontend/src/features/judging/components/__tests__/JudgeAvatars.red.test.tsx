import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadComponent } from '../../../../test/mocks/framerMotion'

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

describe('E24-04 RED: JudgeAvatars', () => {
  beforeEach(() => {
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
    useJudgeSpeechMock.mockReturnValue({
      currentSpeech: null,
      speakingJudge: null,
    })
    useJudgeAvatarStateMock.mockReturnValue({
      avatarStates: {
        hiroyuki: 'base',
        dewi: 'base',
        nakao: 'base',
      },
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })
  it('表示状態に関係なくレンダリングされる', async () => {
    // 何を検証するか: FR-01 - 審査員3名が常に背景に表示されること
    const { JudgeAvatars } = await loadJudgeAvatars()
    const { rerender } = render(<JudgeAvatars isJudging={false} isPostModalOpen={false} />)

    expect(screen.getAllByRole('img')).toHaveLength(3)

    rerender(<JudgeAvatars isJudging={true} isPostModalOpen={false} />)
    expect(screen.getAllByRole('img')).toHaveLength(3)
  }, 15000)

  it('isJudging=false で口癖が表示されない', async () => {
    // 何を検証するか: 審査中でない場合は吹き出しが表示されないこと
    const { JudgeAvatars } = await loadJudgeAvatars()

    render(<JudgeAvatars isJudging={false} isPostModalOpen={false} />)

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('isJudging=true かつ発話者未決定では口癖を表示しない', async () => {
    // 何を検証するか: 待機中は吹き出しを表示しないこと
    const { JudgeAvatars } = await loadJudgeAvatars()

    render(<JudgeAvatars isJudging={true} isPostModalOpen={false} />)

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('横並びレイアウト（grid grid-cols-3）が適用される', async () => {
    // 何を検証するか: 3人の審査員が横一列（3カラムGrid）に並ぶこと
    const { JudgeAvatars } = await loadJudgeAvatars()

    render(<JudgeAvatars isJudging={false} isPostModalOpen={false} />)

    const container = screen.getByTestId('judge-avatars-container')
    expect(container).toHaveClass('grid')
    expect(container).toHaveClass('grid-cols-3')
  })

  it('レスポンシブサイズ指定の代わりに共通CSS変数幅が適用される', async () => {
    // 何を検証するか: 画面幅に依存せず共通のアバター幅定義を使うこと
    const { JudgeAvatars } = await loadJudgeAvatars()

    render(<JudgeAvatars isJudging={false} isPostModalOpen={false} />)

    const avatars = screen.getAllByRole('img')
    avatars.forEach((avatar) => {
      expect(avatar).toHaveStyle({ width: 'var(--judge-avatar-width)' })
    })
  })

  it('アバターコンテナのgapが拡張される', async () => {
    // 何を検証するか: 狭幅スマホでは余白を詰めつつ、タブレット以上で段階的にgapを広げること
    const { JudgeAvatars } = await loadJudgeAvatars()

    render(<JudgeAvatars isJudging={false} isPostModalOpen={false} />)

    const container = screen.getByTestId('judge-avatars-container')
    expect(container).toHaveClass('gap-0')
    expect(container).toHaveClass('px-1.5')
    expect(container.className).toMatch(/max-\[360px\]:px-1/)
    expect(container.className).toMatch(/sm:gap-2/)
    expect(container.className).toMatch(/md:gap-6/)
    expect(container.className).toMatch(/lg:gap-8/)
  })

  it('ステージコンテナのmax-widthとpadding-bottomが拡張される', async () => {
    // 何を検証するか: 大型アバターに合わせて max-w-6xl と pb-16 が適用されること
    const { JudgeAvatars } = await loadJudgeAvatars()

    render(<JudgeAvatars isJudging={false} isPostModalOpen={false} />)

    const stage = screen.getByTestId('judge-stage')
    expect(stage).toHaveClass('max-w-6xl')
    expect(stage).toHaveClass('pb-16')
  })

  it('3人の審査員のalt属性が正しく設定される', async () => {
    // 何を検証するか: アクセシビリティ - 各審査員の画像にalt属性が設定されること
    const { JudgeAvatars } = await loadJudgeAvatars()

    render(<JudgeAvatars isJudging={false} isPostModalOpen={false} />)

    expect(screen.getByAltText('ひろゆき風審査員')).toBeInTheDocument()
    expect(screen.getByAltText('デヴィ夫人風審査員')).toBeInTheDocument()
    expect(screen.getByAltText('中尾彬風審査員')).toBeInTheDocument()
  })

  it('scoringフェーズでスコアパネルが表示される', async () => {
    // 何を検証するか: E25-01の受け入れ基準として、採点フェーズ時に各審査員のスコアが表示されること
    const { JudgeAvatars } = await loadJudgeAvatars()

    render(
      <JudgeAvatars
        isJudging={true}
        isPostModalOpen={false}
        judgingPhase="scoring"
        judgments={[
          { judge: 'nakao', score: 88, success: true },
          { judge: 'hiroyuki', score: 92, success: true },
          { judge: 'dewi', score: 95, success: true },
        ]}
      />
    )

    // 新しい構造では各スロット内にスコアパネルが存在
    const scorePanels = screen.getAllByTestId('judge-desk-score')
    expect(scorePanels).toHaveLength(3)
    // 各パネルはglass-panelクラスを持つ
    scorePanels.forEach((panel) => {
      expect(panel).toHaveClass('glass-panel')
    })
  })
})
