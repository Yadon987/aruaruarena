import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const capturedImgProps: Array<{
  src?: string
  alt?: string
  animate?: unknown
  [key: string]: unknown
}> = []

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    img: ({ src, alt, ...props }: any) => {
      capturedImgProps.push({ src, alt, ...props })
      return <img src={src} alt={alt} {...props} />
    },
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

const useJudgeEntranceMock = vi.fn()
const useJudgeBreathingMock = vi.fn()
const useJudgeSpeechMock = vi.fn()

vi.mock('../../../../shared/hooks/useJudgeEntrance', () => ({
  useJudgeEntrance: () => useJudgeEntranceMock(),
}))
vi.mock('../../../../shared/hooks/useJudgeBreathing', () => ({
  useJudgeBreathing: (args: any) => useJudgeBreathingMock(args),
}))
vi.mock('../../../../shared/hooks/useJudgeSpeech', () => ({
  useJudgeSpeech: () => useJudgeSpeechMock(),
}))

const loadJudgeAvatars = async () => {
  return import('../JudgeAvatars')
}

describe('JudgeAvatars Refactor', () => {
  beforeEach(() => {
    capturedImgProps.length = 0
    vi.clearAllMocks()
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
    useJudgeBreathingMock.mockReturnValue({
      isBreathing: true,
      variants: {
        hiroyuki: {
          keyframes: { scale: [1, 1.02, 1] },
          transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
        },
        dewi: {
          keyframes: { scale: [1, 1.05, 1] },
          transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
        },
        nakao: {
          keyframes: { scale: [1, 1.01, 1] },
          transition: { duration: 5, repeat: Infinity, ease: 'easeInOut' },
        },
      },
    })
    useJudgeSpeechMock.mockReturnValue({ currentSpeech: 'テスト', speakingJudge: 'dewi' })
  })

  it('登場完了後は呼吸アニメーション設定を使う', async () => {
    const { JudgeAvatars } = await loadJudgeAvatars()
    render(<JudgeAvatars isJudging={true} isPostModalOpen={false} />)

    expect(capturedImgProps.length).toBe(3)
    const nakao = capturedImgProps.find((item) => item.alt === '中尾彬風審査員')
    expect(nakao).toBeDefined()
    expect(nakao?.animate).toEqual({ scale: [1, 1.01, 1] })
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
