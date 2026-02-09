import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { api, ApiClientError } from './api'

// fetchのモック
const fetchMock = vi.fn()
global.fetch = fetchMock

describe('E04-06: API Client', () => {
  beforeEach(() => {
    fetchMock.mockClear()
    // VITE_API_BASE_URL のモックは行わず、デフォルト値 "/api" を使用する前提とする
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('正常系 (Happy Path)', () => {
    it('createPost: 正しくリクエストを送信し、レスポンスを返す', async () => {
      const mockResponse = { id: 'uuid-1234', status: 'judging' }
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const requestData = { nickname: 'テスト', body: 'あるあるネタ' }
      const result = await api.posts.create(requestData)

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/posts',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(requestData),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      )
      expect(result).toEqual(mockResponse)
    })

    it('getPost: 投稿IDでデータを取得できる', async () => {
      const mockResponse = {
        id: 'valid-uuid',
        nickname: 'テストユーザー',
        body: 'あるあるbody',
        status: 'judging',
        created_at: '2026-02-10T00:00:00Z',
      }
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await api.posts.get('valid-uuid')

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/posts/valid-uuid',
        expect.any(Object)
      )
      expect(result).toEqual(mockResponse)
    })

    it('getRankings: ランキングデータを取得できる', async () => {
      const mockResponse = {
        rankings: [],
        total_count: 0,
      }
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await api.rankings.list()

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/rankings?limit=20',
        expect.any(Object)
      )
      expect(result).toEqual(mockResponse)
    })

    it('getRankings: limitパラメータを指定できる', async () => {
      const mockResponse = { rankings: [], total_count: 0 }
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => mockResponse })

      await api.rankings.list(10)

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/rankings?limit=10',
        expect.any(Object)
      )
    })
  })

  describe('異常系 (Error Path)', () => {
    it('HTTPエラー: 400エラー時に ApiClientError (VALIDATION_ERROR) がスローされる', async () => {
      const errorResponse = { error: 'バリデーションエラー', code: 'VALIDATION_ERROR' }
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => errorResponse,
      })

      try {
        await api.posts.create({ nickname: '', body: '' })
        throw new Error('Expected ApiClientError to be thrown')
      } catch (unknownError: unknown) {
        expect(unknownError).toBeInstanceOf(ApiClientError)
        const error = unknownError as ApiClientError
        expect(error.code).toBe('VALIDATION_ERROR')
        expect(error.message).toBe('バリデーションエラー')
        expect(error.status).toBe(400)
      }
    })

    it('HTTPエラー: 500エラー時に ApiClientError がスローされる', async () => {
      const errorResponse = { error: 'Internal Server Error', code: 'INTERNAL_ERROR' }
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => errorResponse,
      })

      try {
        await api.posts.get('some-id')
        throw new Error('Expected ApiClientError to be thrown')
      } catch (unknownError: unknown) {
        expect(unknownError).toBeInstanceOf(ApiClientError)
        const error = unknownError as ApiClientError
        expect(error.code).toBe('INTERNAL_ERROR')
        expect(error.status).toBe(500)
      }
    })

    it('レート制限: 429エラー時に RATE_LIMITED がスローされる', async () => {
      // バックエンドがエラーボディを返さない場合でもコードだけで判定できることを確認
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({}),
      })

      try {
        await api.posts.create({ nickname: 'test', body: 'body' })
        throw new Error('Expected ApiClientError to be thrown')
      } catch (unknownError: unknown) {
        expect(unknownError).toBeInstanceOf(ApiClientError)
        const error = unknownError as ApiClientError
        expect(error.code).toBe('RATE_LIMITED')
        expect(error.status).toBe(429)
      }
    })

    it('ネットワークエラー: NETWORK_ERROR がスローされる', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'))

      try {
        await api.posts.get('some-id')
        throw new Error('Expected ApiClientError to be thrown')
      } catch (unknownError: unknown) {
        expect(unknownError).toBeInstanceOf(ApiClientError)
        const error = unknownError as ApiClientError
        expect(error.code).toBe('NETWORK_ERROR')
        expect(error.status).toBe(0)
      }
    })

    it('タイムアウト: AbortError 時に TIMEOUT がスローされる', async () => {
      const abortError = new Error('The user aborted a request.')
      abortError.name = 'AbortError'
      fetchMock.mockRejectedValueOnce(abortError)

      try {
        await api.posts.get('some-id')
        throw new Error('Expected ApiClientError to be thrown')
      } catch (unknownError: unknown) {
        expect(unknownError).toBeInstanceOf(ApiClientError)
        const error = unknownError as ApiClientError
        expect(error.code).toBe('TIMEOUT')
        expect(error.status).toBe(408)
      }
    })

    it('JSONパース失敗: フォールバックエラーメッセージが使用される', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => { throw new Error('Invalid JSON') },
      })

      try {
        await api.posts.get('some-id')
        throw new Error('Expected ApiClientError to be thrown')
      } catch (unknownError: unknown) {
        expect(unknownError).toBeInstanceOf(ApiClientError)
        const error = unknownError as ApiClientError
        expect(error.code).toBe('HTTP_ERROR')
        expect(error.message).toBe('HTTP 500 Error')
      }
    })
  })

  describe('境界値 (Edge Case)', () => {
    it('204 No Content: 空オブジェクトが返る', async () => {
      const responseMock = {
        ok: true,
        status: 204,
        json: vi.fn(),
      }
      fetchMock.mockResolvedValueOnce(responseMock)

      // @ts-ignore
      const result = await api.posts.create({ nickname: 'test', body: 'body' })

      expect(result).toEqual({})
      expect(responseMock.json).not.toHaveBeenCalled()
    })

    it('環境変数未設定時: デフォルト /api が使用される', async () => {
      // beforeEachでデフォルト設定の実装を確認済みだが、明示的にURLを検証
      const mockResponse = { id: 'uuid', status: 'judging' }
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => mockResponse })

      await api.posts.create({ nickname: 'test', body: 'body' })

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/^\/api\//),
        expect.any(Object)
      )
    })
  })

  describe('HTTPエラー: 追加ステータスコード', () => {
    it('401 Unauthorized', async () => {
      const errorResponse = { error: '認証が必要です', code: 'UNAUTHORIZED' }
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => errorResponse,
      })

      try {
        await api.posts.get('some-id')
        throw new Error('Expected ApiClientError to be thrown')
      } catch (unknownError: unknown) {
        expect(unknownError).toBeInstanceOf(ApiClientError)
        const error = unknownError as ApiClientError
        expect(error.status).toBe(401)
        expect(error.code).toBe('UNAUTHORIZED')
      }
    })

    it('403 Forbidden', async () => {
      const errorResponse = { error: 'アクセス権限がありません', code: 'FORBIDDEN' }
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => errorResponse,
      })

      try {
        await api.posts.create({ nickname: 'test', body: 'body' })
        throw new Error('Expected ApiClientError to be thrown')
      } catch (unknownError: unknown) {
        expect(unknownError).toBeInstanceOf(ApiClientError)
        const error = unknownError as ApiClientError
        expect(error.status).toBe(403)
      }
    })

    it('404 Not Found', async () => {
      const errorResponse = { error: 'リソースが見つかりません', code: 'NOT_FOUND' }
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => errorResponse,
      })

      try {
        await api.posts.get('non-existent-id')
        throw new Error('Expected ApiClientError to be thrown')
      } catch (unknownError: unknown) {
        expect(unknownError).toBeInstanceOf(ApiClientError)
        const error = unknownError as ApiClientError
        expect(error.status).toBe(404)
      }
    })

    it('502 Bad Gateway', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => ({ error: 'Bad Gateway', code: 'BAD_GATEWAY' }),
      })

      try {
        await api.posts.get('some-id')
        throw new Error('Expected ApiClientError to be thrown')
      } catch (unknownError: unknown) {
        expect(unknownError).toBeInstanceOf(ApiClientError)
        const error = unknownError as ApiClientError
        expect(error.status).toBe(502)
      }
    })

    it('503 Service Unavailable', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: 'Service Unavailable', code: 'SERVICE_UNAVAILABLE' }),
      })

      try {
        await api.posts.get('some-id')
        throw new Error('Expected ApiClientError to be thrown')
      } catch (unknownError: unknown) {
        expect(unknownError).toBeInstanceOf(ApiClientError)
        const error = unknownError as ApiClientError
        expect(error.status).toBe(503)
      }
    })
  })

  describe('カスタム設定', () => {
    it('カスタムタイムアウト: timeout オプションが正しく動作する', async () => {
      const abortError = new Error('The user aborted a request.')
      abortError.name = 'AbortError'
      fetchMock.mockRejectedValueOnce(abortError)

      try {
        // @ts-ignore - timeout オプションは内部実装
        await api.posts.get('some-id', { timeout: 1000 })
        throw new Error('Expected ApiClientError to be thrown')
      } catch (unknownError: unknown) {
        expect(unknownError).toBeInstanceOf(ApiClientError)
        const error = unknownError as ApiClientError
        expect(error.code).toBe('TIMEOUT')
      }
    })
  })

  describe('エラーコードのフォールバック', () => {
    it('429エラー: バックエンドがエラーコードを返さない場合、RATE_LIMITED が使用される', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: 'Too many requests' }), // code プロパティなし
      })

      try {
        await api.posts.create({ nickname: 'test', body: 'body' })
        throw new Error('Expected ApiClientError to be thrown')
      } catch (unknownError: unknown) {
        expect(unknownError).toBeInstanceOf(ApiClientError)
        const error = unknownError as ApiClientError
        expect(error.code).toBe('RATE_LIMITED')
        expect(error.message).toBe('Too many requests')
      }
    })
  })
})
