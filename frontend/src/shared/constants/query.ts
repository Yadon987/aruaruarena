/**
 * TanStack Queryのデフォルト設定
 */
export const QUERY_CONFIG = {
  /** デフォルトのランキング取得件数 */
  DEFAULT_RANKING_LIMIT: 20,
  /** ネットワークエラー時のリトライ回数 */
  MAX_RETRY_COUNT: 1,
  /** キャッシュの有効期限（ミリ秒） */
  STALE_TIME: 5 * 60 * 1000 as number, // 5分
  /** キャッシュ保持時間（ミリ秒） */
  GC_TIME: 10 * 60 * 1000 as number, // 10分
} as const

/** デフォルトのランキング取得件数（数値型） */
export const DEFAULT_RANKING_LIMIT = QUERY_CONFIG.DEFAULT_RANKING_LIMIT
