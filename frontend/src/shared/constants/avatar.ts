import type { JudgePersona } from '../types/domain.ts'
import { JUDGE } from './validation.ts'

/** アバターの状態（base: 通常、mouth_open: 口パク、eye_closed: 瞬き） */
export type AvatarState = 'base' | 'mouth_open' | 'eye_closed'

/** 審査員の表示名（スクリーンリーダー用ラベル） */
export const JUDGE_LABELS: Record<JudgePersona, string> = {
  hiroyuki: 'ひろゆき風',
  dewi: 'デヴィ婦人風',
  nakao: '中尾彬風',
}

/**
 * アバターアニメーション設定
 *
 * - 口パク継続時間: 120ms
 * - 瞬き継続時間: 150ms
 * - 間隔は範囲で管理し、将来ランダム化しても定数を再利用できる
 */
export const AVATAR_ANIMATION = {
  /** 口パクの継続時間（ms） */
  MOUTH_DURATION_MS: 120,
  /** 瞬きの継続時間（ms） */
  BLINK_DURATION_MS: 150,
  /** 口パクの最小間隔（ms） */
  MOUTH_INTERVAL_MIN_MS: 2000,
  /** 口パクの最大間隔（ms） */
  MOUTH_INTERVAL_MAX_MS: 4000,
  /** 瞬きの最小間隔（ms） */
  BLINK_INTERVAL_MIN_MS: 3000,
  /** 瞬きの最大間隔（ms） */
  BLINK_INTERVAL_MAX_MS: 5000,
} as const

/** アバター画像のベースパス */
export const AVATAR_BASE_PATH = '/images/avatars' as const

/** アバターの全状態一覧 */
const AVATAR_STATES: AvatarState[] = ['base', 'mouth_open', 'eye_closed']

/**
 * アバター画像のパスを生成する
 *
 * @param persona 審査員ペルソナ
 * @param state アバター状態
 * @returns 画像パス
 */
export function getAvatarImagePath(persona: JudgePersona, state: AvatarState): string {
  return `${AVATAR_BASE_PATH}/${persona}/${state}.png`
}

/**
 * 審査員のaria-labelを生成する
 *
 * @param persona 審査員ペルソナ
 * @returns アクセシビリティ用ラベル
 */
export function getJudgeAriaLabel(persona: JudgePersona): string {
  return `${JUDGE_LABELS[persona]}の審査員アバター`
}

/**
 * 全アバター画像のパス一覧を取得する
 *
 * @returns 全画像パスの配列
 */
export function getAllAvatarImagePaths(): string[] {
  return JUDGE.PERSONAS.flatMap((persona) =>
    AVATAR_STATES.map((state) => getAvatarImagePath(persona, state))
  )
}
