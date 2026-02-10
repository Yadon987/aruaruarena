/**
 * Rankings API ハンドラー
 *
 * ランキング取得のハンドラーを定義します。
 */
import { http, HttpResponse } from 'msw'
import { RANKING } from './constants'
import { createMockRankings } from './helpers'

export const rankingsHandlers = [
  /**
   * GET /api/rankings
   *
   * ランキング一覧を取得します。
   * limit クエリパラメータで取得件数を指定できます。
   */
  http.get('/api/rankings', ({ request }) => {
    // limit クエリパラメータをパース（無効な場合はデフォルト値を使用）
    const url = new URL(request.url)
    const limitParam = url.searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : RANKING.DEFAULT_COUNT
    const validLimit = isNaN(limit) ? RANKING.DEFAULT_COUNT : Math.max(0, limit)

    return HttpResponse.json(createMockRankings(validLimit))
  }),
]
