/**
 * エラーハンドラー
 *
 * 異常系テスト用のエラーハンドラーを定義します。
 */
import { http, HttpResponse } from 'msw'
import { HTTP_STATUS, API_ERROR_CODE } from '@shared/constants/api'

/** エラーハンドラー専用のエラーコード（API_ERROR_CODEに未定義のため） */
const MOCK_ERROR_CODE = {
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
} as const

export const errorHandlers = {
  /**
   * GET /api/posts/non-existent
   *
   * 404 Not Found エラーを返します。
   */
  notFound: http.get('/api/posts/non-existent', () => {
    return HttpResponse.json(
      { error: '投稿が見つかりません', code: MOCK_ERROR_CODE.NOT_FOUND },
      { status: HTTP_STATUS.NOT_FOUND }
    )
  }),

  /**
   * POST /api/posts/validation-error
   *
   * 400 Validation Error を返します。
   */
  validationError: http.post('/api/posts/validation-error', () => {
    return HttpResponse.json(
      { error: 'バリデーションエラー', code: MOCK_ERROR_CODE.VALIDATION_ERROR },
      { status: HTTP_STATUS.BAD_REQUEST }
    )
  }),

  /**
   * POST /api/posts/rate-limited
   *
   * 429 Rate Limited エラーを返します。
   */
  rateLimited: http.post('/api/posts/rate-limited', () => {
    return HttpResponse.json(
      { error: '投稿頻度を制限中', code: API_ERROR_CODE.RATE_LIMITED },
      { status: HTTP_STATUS.TOO_MANY_REQUESTS }
    )
  }),

  /**
   * GET /api/rankings
   *
   * 429 Rate Limited エラーを返します。
   */
  rankingsRateLimited: http.get('/api/rankings', () => {
    return HttpResponse.json(
      {
        error: 'アクセスが集中しています。しばらく待ってから再度お試しください。',
        code: API_ERROR_CODE.RATE_LIMITED,
      },
      { status: HTTP_STATUS.TOO_MANY_REQUESTS }
    )
  }),

  /**
   * GET /api/rankings
   *
   * 500 Internal Server Error を返します。
   */
  rankingsServerError: http.get('/api/rankings', () => {
    return HttpResponse.json(
      { error: 'サーバーエラー', code: API_ERROR_CODE.HTTP_ERROR },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    )
  }),

  /**
   * GET /api/rankings
   *
   * ネットワークエラーをシミュレートします。
   */
  rankingsNetworkError: http.get('/api/rankings', () => {
    return HttpResponse.error()
  }),

  /**
   * GET /api/posts/network-error
   *
   * ネットワークエラーをシミュレートします。
   */
  networkError: http.get('/api/posts/network-error', () => {
    return HttpResponse.error()
  }),
}
