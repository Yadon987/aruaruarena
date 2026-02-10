/**
 * Posts API ハンドラー
 *
 * 投稿作成、取得、ポーリングのハンドラーを定義します。
 */
import { http, HttpResponse } from 'msw'
import { POLLING, MOCK } from './constants'
import { createMockPost } from './helpers'

/** ポーリングリクエストカウンター */
let pollingCount = 0

/**
 * テスト用ポーリングカウンターリセット関数
 *
 * afterEach フックで呼び出して、テスト間の状態漏れを防ぎます。
 */
export function resetPollingCount() {
  pollingCount = 0
}

export const postsHandlers = [
  /**
   * POST /api/posts
   *
   * 新しい投稿を作成します。
   */
  http.post('/api/posts', async () => {
    return HttpResponse.json({
      id: MOCK.UUID_PREFIX + Date.now(),
      status: 'judging',
    })
  }),

  /**
   * GET /api/posts/:id
   *
   * 投稿詳細を取得します。
   *
   * 特別なケース:
   * - id === 'polling-test' の場合、ポーリングテストとして動作
   *   - 1-2回目のリクエスト: judging
   *   - 3回目のリクエスト: scored
   */
  http.get('/api/posts/:id', ({ params }) => {
    const { id } = params

    // ポーリングテスト用の特別な挙動
    if (id === POLLING.TEST_POST_ID) {
      pollingCount++
      if (pollingCount < POLLING.TRANSITION_COUNT) {
        // 1-2回目: judging
        return HttpResponse.json(
          createMockPost({
            id: POLLING.TEST_POST_ID,
            body: MOCK.POLLING_BODY,
          })
        )
      }
      // 3回目: scored
      pollingCount = 0
      return HttpResponse.json(
        createMockPost({
          id: POLLING.TEST_POST_ID,
          body: MOCK.POLLING_BODY,
          status: 'scored',
          average_score: MOCK.AVERAGE_SCORE,
        })
      )
    }

    // デフォルト: 一般的な投稿取得
    return HttpResponse.json(createMockPost({ id: String(id) }))
  }),
]
