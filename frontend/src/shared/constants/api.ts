/**
 * APIクライアント関連の定数
 *
 * HTTPステータスコード、タイムアウト設定、エラーコードなどを定義します。
 */

/**
 * HTTPステータスコード
 */
export const HTTP_STATUS = {
  /** 成功 (No Content) */
  NO_CONTENT: 204,
  /** Bad Request */
  BAD_REQUEST: 400,
  /** Unauthorized */
  UNAUTHORIZED: 401,
  /** Forbidden */
  FORBIDDEN: 403,
  /** Not Found */
  NOT_FOUND: 404,
  /** Request Timeout */
  REQUEST_TIMEOUT: 408,
  /** Too Many Requests */
  TOO_MANY_REQUESTS: 429,
  /** Internal Server Error */
  INTERNAL_SERVER_ERROR: 500,
  /** Bad Gateway */
  BAD_GATEWAY: 502,
  /** Service Unavailable */
  SERVICE_UNAVAILABLE: 503,
} as const

/**
 * タイムアウト設定 (ミリ秒)
 */
export const API_TIMEOUT = {
  /** デフォルトタイムアウト (10秒) */
  DEFAULT: 10000,
} as const

/**
 * エラーコード
 */
export const API_ERROR_CODE = {
  /** HTTPエラー (汎用) */
  HTTP_ERROR: 'HTTP_ERROR',
  /** ネットワークエラー */
  NETWORK_ERROR: 'NETWORK_ERROR',
  /** タイムアウトエラー */
  TIMEOUT: 'TIMEOUT',
  /** リクエスト中断（キャンセル） */
  ABORTED: 'ABORTED',
  /** レート制限エラー */
  RATE_LIMITED: 'RATE_LIMITED',
} as const

/**
 * デフォルト設定
 */
export const API_DEFAULTS = {
  /** ランキング取得のデフォルト件数 */
  RANKING_LIMIT: 20,
} as const
