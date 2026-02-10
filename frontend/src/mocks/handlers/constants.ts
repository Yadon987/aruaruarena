/**
 * MSWハンドラー用定数
 *
 * モックデータ生成やハンドラー設定で使用する定数を定義します。
 */

/**
 * ポーリング設定
 */
export const POLLING = {
  /** judging → scored に遷移するまでのリクエスト回数 */
  TRANSITION_COUNT: 3,
  /** ポーリングテスト用の投稿ID */
  TEST_POST_ID: 'polling-test',
} as const

/**
 * モックデータ生成用
 */
export const MOCK = {
  /** UUIDプレフィックス */
  UUID_PREFIX: 'mock-uuid-',
  /** タイムスタンプ */
  TIMESTAMP: '2026-02-10T00:00:00Z',
  /** デフォルトニックネーム */
  DEFAULT_NICKNAME: 'テストユーザー',
  /** デフォルト投稿本文 */
  DEFAULT_BODY: 'テスト投稿',
  /** ポーリングテスト用投稿本文 */
  POLLING_BODY: 'ポーリングテスト',
  /** デフォルト平均スコア */
  AVERAGE_SCORE: 85,
} as const

/**
 * ランキング設定
 */
export const RANKING = {
  /** デフォルトランキング件数 */
  DEFAULT_COUNT: 2,
  /** ランキングスコア */
  SCORES: [90, 85],
} as const
