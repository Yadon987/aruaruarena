import type { JudgePersona } from '../types/domain.ts'

/** アバターの状態 */
export type AvatarState = 'base' | 'mouth_open' | 'eye_closed'

/** 審査員の表示名 */
export const JUDGE_LABELS: Record<JudgePersona, string> = {
  hiroyuki: 'ひろゆき風',
  dewi: 'デヴィ婦人風',
  nakao: '中尾彬風',
}

/** アバターアニメーション設定 */
export const AVATAR_ANIMATION = {
  MOUTH_DURATION_MS: 120,
  BLINK_DURATION_MS: 150,
  MOUTH_INTERVAL_MIN_MS: 2000,
  MOUTH_INTERVAL_MAX_MS: 4000,
  BLINK_INTERVAL_MIN_MS: 3000,
  BLINK_INTERVAL_MAX_MS: 5000,
} as const

/** アバター画像のベースパス */
export const AVATAR_BASE_PATH = '/images/avatars' as const

/**
 * アバター画像のパスを生成する
 */
export function getAvatarImagePath(persona: JudgePersona, state: AvatarState): string {
  return `${AVATAR_BASE_PATH}/${persona}/${state}.png`
}

/**
 * 審査員のaria-labelを生成する
 */
export function getJudgeAriaLabel(persona: JudgePersona): string {
  return `${JUDGE_LABELS[persona]}の審査員アバター`
}

/**
 * 全アバター画像のパス一覧を取得する
 */
export function getAllAvatarImagePaths(): string[] {
  const personas: JudgePersona[] = ['hiroyuki', 'dewi', 'nakao']
  const states: AvatarState[] = ['base', 'mouth_open', 'eye_closed']

  return personas.flatMap((persona) => states.map((state) => getAvatarImagePath(persona, state)))
}
