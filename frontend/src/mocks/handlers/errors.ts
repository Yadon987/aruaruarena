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

export const errorHandlers = [
  /**
   * GET /api/posts/non-existent
   *
   * 404 Not Found エラーを返します。
   */
  http.get('/api/posts/non-existent', () => {
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
  http.post('/api/posts/validation-error', () => {
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
  http.post('/api/posts/rate-limited', () => {
    return HttpResponse.json(
      { error: '投稿頻度を制限中', code: API_ERROR_CODE.RATE_LIMITED },
      { status: HTTP_STATUS.TOO_MANY_REQUESTS }
    )
  }),

  /**
   * GET /api/posts/network-error
   *
   * ネットワークエラーをシミュレートします。
   */
  http.get('/api/posts/network-error', () => {
    return HttpResponse.error()
  }),
]
