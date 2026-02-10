import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { api, ApiClientError } from '../../shared/services/api'
import { mswServer } from '../server'
import { resetPollingCount } from '../handlers/posts'
import { errorHandlers } from '../handlers'
import { http, HttpResponse } from 'msw'

describe('E04-09: MSW Integration', () => {
  beforeAll(() => mswServer.listen({ onUnhandledRequest: 'error' }))
  afterEach(() => {
    mswServer.resetHandlers()
    resetPollingCount()  // ポーリング状態をリセット
  })
  afterAll(() => mswServer.close())

  describe('正常系', () => {
    it('POST /api/posts がモックレスポンスを返す', async () => {
      const result = await api.posts.create({ nickname: 'test', body: 'body' })
      expect(result).toHaveProperty('id')
      expect(result.status).toBe('judging')
    })

    it('GET /api/posts/:id が投稿詳細を返す', async () => {
      const result = await api.posts.get('test-id')
      expect(result).toHaveProperty('id')
      expect(result).toHaveProperty('nickname')
      expect(result).toHaveProperty('status')
    })

    it('GET /api/rankings?limit=20 がランキングを返す', async () => {
      const result = await api.rankings.list(20)
      expect(result).toHaveProperty('rankings')
      expect(result).toHaveProperty('total_count')
    })

    it('ポーリングで judging → scored に遷移する', async () => {
      // 1回目: judging
      const r1 = await api.posts.get('polling-test')
      expect(r1.status).toBe('judging')

      // 2回目: judging
      const r2 = await api.posts.get('polling-test')
      expect(r2.status).toBe('judging')

      // 3回目: scored
      const r3 = await api.posts.get('polling-test')
      expect(r3.status).toBe('scored')
      expect(r3.average_score).toBeDefined()
    })
  })

  describe('異常系', () => {
    it('存在しないIDで404エラーが返る', async () => {
      // エラーハンドラーを一時的に適用
      mswServer.use(errorHandlers[0])

      try {
        await api.posts.get('non-existent')
        throw new Error('Expected ApiClientError to be thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiClientError)
        const err = error as ApiClientError
        expect(err.status).toBe(404)
        expect(err.code).toBe('NOT_FOUND')
      }
    })

    it('バリデーションエラーで400エラーが返る', async () => {
      // POST /api/posts を上書きしてバリデーションエラーを返す
      mswServer.use(
        http.post('/api/posts', () => {
          return HttpResponse.json(
            { error: 'バリデーションエラー', code: 'VALIDATION_ERROR' },
            { status: 400 }
          )
        })
      )

      try {
        await api.posts.create({ nickname: '', body: '' })
        throw new Error('Expected ApiClientError to be thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiClientError)
        const err = error as ApiClientError
        expect(err.status).toBe(400)
        expect(err.code).toBe('VALIDATION_ERROR')
      }
    })

    it('レート制限で429エラーが返る', async () => {
      // POST /api/posts を上書きしてレート制限エラーを返す
      mswServer.use(
        http.post('/api/posts', () => {
          return HttpResponse.json(
            { error: '投稿頻度を制限中', code: 'RATE_LIMITED' },
            { status: 429 }
          )
        })
      )

      try {
        await api.posts.create({ nickname: 'test', body: 'body' })
        throw new Error('Expected ApiClientError to be thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiClientError)
        const err = error as ApiClientError
        expect(err.status).toBe(429)
        expect(err.code).toBe('RATE_LIMITED')
      }
    })

    it('ネットワークエラーがスローされる', async () => {
      // エラーハンドラーを一時的に適用
      mswServer.use(errorHandlers[3])

      try {
        await api.posts.get('network-error')
        throw new Error('Expected ApiClientError to be thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiClientError)
        const err = error as ApiClientError
        expect(err.code).toBe('NETWORK_ERROR')
      }
    })
  })

  describe('境界値', () => {
    it('ポーリングリセット後の挙動が正しい', async () => {
      // 最初のポーリング
      const r1 = await api.posts.get('polling-test')
      expect(r1.status).toBe('judging')

      // リセット
      resetPollingCount()

      // リセット後は1回目から再開
      const r2 = await api.posts.get('polling-test')
      expect(r2.status).toBe('judging')
    })

    it('空のランキングが正しく返る', async () => {
      // 空のランキングを返すハンドラーを一時的に適用
      mswServer.use(
        http.get('/api/rankings', () => {
          return HttpResponse.json({ rankings: [], total_count: 0 })
        })
      )

      const result = await api.rankings.list()
      expect(result.rankings).toEqual([])
      expect(result.total_count).toBe(0)
    })
  })
})
