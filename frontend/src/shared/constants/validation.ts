/**
 * バリデーション関連の定数
 *
 * スコア範囲、文字数制限、審査員情報などの共通定数を定義します。
 *
 * @remarks
 * 型定義（JudgePersona, PostStatus）は types/domain.ts で定義されています。
 * このファイルでは定数のみをエクスポートします。
 */

/**
 * スコア関連の定数
 */
export const SCORE = {
  /** 合計スコアの最大値 */
  TOTAL_MAX: 100,
  /** 合計スコアの最小値 */
  TOTAL_MIN: 0,
  /** 各項目スコアの最大値 */
  ITEM_MAX: 20,
  /** 各項目スコアの最小値 */
  ITEM_MIN: 0,
  /** スコア項目数 (empathy, humor, brevity, originality, expression) */
  ITEMS_COUNT: 5,
} as const

/**
 * 文字数制限の定数
 */
export const TEXT_LENGTH = {
  /** ニックネームの最小文字数 */
  NICKNAME_MIN: 1,
  /** ニックネームの最大文字数 */
  NICKNAME_MAX: 20,
  /** 投稿本文の最小文字数 */
  BODY_MIN: 3,
  /** 投稿本文の最大文字数 */
  BODY_MAX: 30,
} as const

/**
 * 審査員関連の定数
 */
export const JUDGE = {
  /** 審査員数 */
  COUNT: 3,
  /** 審査成功に必要な人数 */
  REQUIRED_SUCCESS_COUNT: 2,
  /** 審査員ペルソナ */
  PERSONAS: ['hiroyuki', 'dewi', 'nakao'] as const,
} as const

/**
 * 投稿ステータスの定数
 */
export const POST_STATUS = {
  /** 投稿ステータスの値 */
  VALUES: ['judging', 'scored', 'failed'] as const,
} as const
