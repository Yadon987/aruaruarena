import { HTTP_STATUS, API_TIMEOUT, API_ERROR_CODE, API_DEFAULTS } from '../constants/api'
import {
  type ApiError,
  type CreatePostRequest,
  type CreatePostResponse,
  type GetPostResponse,
  type GetRankingResponse,
} from '../types/api'

// 環境変数の取得（Vite）
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

// 開発環境でのバリデーション
if (import.meta.env.DEV && !import.meta.env.VITE_API_BASE_URL) {
  console.warn('VITE_API_BASE_URL is not set, using default: /api')
}

/**
 * APIクライアントエラー
 */
export class ApiClientError extends Error {
  constructor(
    public message: string,
    public code: string,
    public status: number
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

/**
 * ネットワークエラーを ApiClientError に変換
 *
 * @param error - キャッチされたエラー
 * @throws ApiClientError - 変換されたエラー
 */
function handleNetworkError(error: unknown): never {
  // タイムアウトエラー
  if (error instanceof Error && error.name === 'AbortError') {
    throw new ApiClientError('Request timeout', API_ERROR_CODE.TIMEOUT, HTTP_STATUS.REQUEST_TIMEOUT)
  }

  // ネットワークエラー
  if (error instanceof TypeError) {
    throw new ApiClientError('Network error', API_ERROR_CODE.NETWORK_ERROR, 0)
  }

  throw error
}

/**
 * HTTPレスポンスエラーを ApiClientError に変換
 *
 * @param response - エラーレスポンス
 * @throws ApiClientError - 変換されたエラー
 */
async function handleHttpError(response: Response): Promise<never> {
  let errorCode: string = API_ERROR_CODE.HTTP_ERROR
  let errorMessage: string = `HTTP ${response.status} Error`

  // ステータスコードに基づくエラーコードの推測
  if (response.status === HTTP_STATUS.TOO_MANY_REQUESTS) {
    errorCode = API_ERROR_CODE.RATE_LIMITED
  }

  // バックエンドからのエラー情報をパース
  try {
    const error: ApiError = await response.json()
    if (error.code) errorCode = error.code
    if (error.error) errorMessage = error.error
  } catch {
    // JSONパース失敗時はデフォルト値を使用
  }

  throw new ApiClientError(errorMessage, errorCode, response.status)
}

/**
 * レスポンスボディをパース
 *
 * @param response - fetchレスポンス
 * @returns パースされたレスポンスデータ
 */
async function parseResponseBody<T>(response: Response): Promise<T> {
  // 204 No Content のハンドリング
  if (response.status === HTTP_STATUS.NO_CONTENT) {
    return {} as T
  }

  return response.json()
}

/**
 * 汎用リクエスト関数
 *
 * @param path - APIパス (例: '/posts')
 * @param options - fetch オプション + タイムアウト設定
 * @returns パースされたレスポンスデータ
 * @throws ApiClientError - ネットワークエラー、HTTPエラー、タイムアウト時
 */
async function request<T>(path: string, options?: RequestInit & { timeout?: number }): Promise<T> {
  const timeout = options?.timeout ?? API_TIMEOUT.DEFAULT
  const controller = new AbortController()
  const externalSignal = options?.signal
  const hasExternalSignal = typeof externalSignal !== 'undefined'
  let isTimeoutTriggered = false
  const timeoutId = setTimeout(() => {
    isTimeoutTriggered = true
    controller.abort()
  }, timeout)
  const handleExternalAbort = () => controller.abort()

  if (externalSignal) {
    if (externalSignal.aborted) {
      handleExternalAbort()
    } else {
      externalSignal.addEventListener('abort', handleExternalAbort, { once: true })
    }
  }

  try {
    const { timeout: _timeout, headers: customHeaders, ...restOptions } = options ?? {}
    const mergedHeaders = new Headers(customHeaders)
    const body = restOptions.body
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
    const isUrlSearchParams = typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams
    const isBlob = typeof Blob !== 'undefined' && body instanceof Blob
    const shouldSetJsonContentType =
      !mergedHeaders.has('Content-Type') && !isFormData && !isUrlSearchParams && !isBlob

    if (shouldSetJsonContentType) {
      mergedHeaders.set('Content-Type', 'application/json')
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: mergedHeaders,
      credentials: 'same-origin',
      ...restOptions,
      signal: controller.signal,
    })

    if (!response.ok) {
      await handleHttpError(response)
    }

    return parseResponseBody<T>(response)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      if (isTimeoutTriggered || !hasExternalSignal) {
        throw new ApiClientError(
          'Request timeout',
          API_ERROR_CODE.TIMEOUT,
          HTTP_STATUS.REQUEST_TIMEOUT
        )
      }

      throw new ApiClientError('Request aborted', API_ERROR_CODE.ABORTED, 0)
    }

    handleNetworkError(error)
  } finally {
    clearTimeout(timeoutId)
    if (externalSignal) {
      externalSignal.removeEventListener('abort', handleExternalAbort)
    }
  }
}

/**
 * 型付きAPIクライアント
 */
export const api = {
  posts: {
    create: (data: CreatePostRequest) =>
      request<CreatePostResponse>('/posts', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    get: (id: string, options?: RequestInit & { timeout?: number }) =>
      request<GetPostResponse>(`/posts/${id}`, options),
  },
  rankings: {
    list: (limit: number = API_DEFAULTS.RANKING_LIMIT) =>
      request<GetRankingResponse>(`/rankings?limit=${limit}`),
  },
}
