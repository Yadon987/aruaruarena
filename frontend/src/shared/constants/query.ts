/**
 * TanStack Queryのデフォルト設定
 */
export const QUERY_CONFIG = {
  /** デフォルトのランキング取得件数 */
  DEFAULT_RANKING_LIMIT: 20,
  /** ランキング表示の最小件数 */
  MIN_RANKING_LIMIT: 1,
  /** ランキング表示の最大件数 */
  MAX_RANKING_LIMIT: 20,
  /** ランキング再取得の間隔（ミリ秒） */
  RANKING_POLLING_INTERVAL_MS: 3000,
  /** ネットワークエラー時のリトライ回数 */
  MAX_RETRY_COUNT: 1,
  /** キャッシュの有効期限（ミリ秒） */
  STALE_TIME: 5 * 60 * 1000 as number, // 5分
  /** キャッシュ保持時間（ミリ秒） */
  GC_TIME: 10 * 60 * 1000 as number, // 10分
} as const

/** デフォルトのランキング取得件数（数値型） */
export const DEFAULT_RANKING_LIMIT = QUERY_CONFIG.DEFAULT_RANKING_LIMIT
/** ランキング取得件数の最小値 */
export const MIN_RANKING_LIMIT = QUERY_CONFIG.MIN_RANKING_LIMIT
/** ランキング取得件数の最大値 */
export const MAX_RANKING_LIMIT = QUERY_CONFIG.MAX_RANKING_LIMIT
/** ランキング再取得の間隔（ミリ秒） */
export const RANKING_POLLING_INTERVAL_MS = QUERY_CONFIG.RANKING_POLLING_INTERVAL_MS
