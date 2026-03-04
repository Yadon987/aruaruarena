import { describe, expect, it } from 'vitest'
import { JUDGE } from '../validation.ts'

const loadAvatarModule = () => import('../avatar.ts')

describe('E23-01 RED: アバター定数', () => {
  it('アニメーション定数が仕様どおりに定義されている', async () => {
    // 何を検証するか: 口パクと瞬きの継続時間・間隔が受け入れ基準どおりであること
    const { AVATAR_ANIMATION } = await loadAvatarModule()

    expect(AVATAR_ANIMATION.MOUTH_DURATION_MS).toBe(120)
    expect(AVATAR_ANIMATION.BLINK_DURATION_MS).toBe(150)
    expect(AVATAR_ANIMATION.MOUTH_INTERVAL_MIN_MS).toBe(2000)
    expect(AVATAR_ANIMATION.MOUTH_INTERVAL_MAX_MS).toBe(4000)
    expect(AVATAR_ANIMATION.BLINK_INTERVAL_MIN_MS).toBe(3000)
    expect(AVATAR_ANIMATION.BLINK_INTERVAL_MAX_MS).toBe(5000)
  })

  it('アバター画像パス関連の定数と一覧を返せる', async () => {
    // 何を検証するか: 3人 x 3表情の全9枚をプリロードできるパス一覧が生成されること
    const { AVATAR_BASE_PATH, getAllAvatarImagePaths } = await loadAvatarModule()
    const avatarPaths = getAllAvatarImagePaths()
    const avatarStates = ['base', 'mouth_open', 'eye_closed']

    expect(AVATAR_BASE_PATH).toBe('/images')
    expect(avatarPaths).toHaveLength(JUDGE.PERSONAS.length * avatarStates.length)
    expect(avatarPaths).toContain('/images/hiroyuki_base.png')
    expect(avatarPaths).toContain('/images/dewi_mouth_open.png')
    expect(avatarPaths).toContain('/images/nakao_eye_closed.png')
  })

  it('審査員ラベルとアクセシビリティ用ラベルを返せる', async () => {
    // 何を検証するか: スクリーンリーダー向けに審査員名を含むラベルを生成できること
    const { JUDGE_LABELS, getJudgeAriaLabel } = await loadAvatarModule()

    expect(JUDGE_LABELS.hiroyuki).toBe('ひろゆき風')
    expect(JUDGE_LABELS.dewi).toBe('デヴィ婦人風')
    expect(JUDGE_LABELS.nakao).toBe('中尾彬風')
    expect(getJudgeAriaLabel('hiroyuki')).toContain('ひろゆき風')
  })
})
