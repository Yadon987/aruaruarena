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
 * 汎用リクエスト関数
 */
async function request<T>(
  path: string,
  options?: RequestInit & { timeout?: number }
): Promise<T> {
  const timeout = options?.timeout ?? 10000
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      credentials: 'same-origin',
      ...options,
      signal: controller.signal,
    })
  } catch (error) {
    clearTimeout(timeoutId)

    // タイムアウトエラーの識別
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiClientError('Request timeout', 'TIMEOUT', 408)
    }

    // ネットワークエラー
    if (error instanceof TypeError) {
      throw new ApiClientError('Network error', 'NETWORK_ERROR', 0)
    }

    throw error
  }

  clearTimeout(timeoutId)

  // 204 No Content のハンドリング
  if (response.status === 204) {
    return {} as T
  }

  if (!response.ok) {
    // JSONパース失敗時のフォールバック
    let errorCode = 'HTTP_ERROR'
    let errorMessage = `HTTP ${response.status} Error`

    // レート制限エラーの識別
    if (response.status === 429) {
      errorCode = 'RATE_LIMITED'
    }

    try {
      const error: ApiError = await response.json()
      if (error.code) errorCode = error.code
      if (error.error) errorMessage = error.error
    } catch {
      // JSONパース失敗時はデフォルト値を使用
    }

    throw new ApiClientError(errorMessage, errorCode, response.status)
  }

  return response.json()
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
    get: (id: string) => request<GetPostResponse>(`/posts/${id}`),
  },
  rankings: {
    list: (limit = 20) =>
      request<GetRankingResponse>(`/rankings?limit=${limit}`),
  },
}
