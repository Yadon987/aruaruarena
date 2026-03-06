import { DEFAULT_RANKING_LIMIT, MAX_RANKING_LIMIT } from '../../../shared/constants/query'
import { HTTP_STATUS } from '../../../shared/constants/api'
import { useRankings } from '../../../shared/hooks/useRankings'
import { ApiClientError } from '../../../shared/services/api'
import type { RankingItem } from '../../../shared/types/domain'

type RankingSectionProps = {
  myPostIds: string[]
  onSelectRankingPost: (postId: string) => void
  polling?: boolean
}

const RANKING_ERROR_MESSAGES = {
  rateLimited: 'アクセスが集中しています。しばらく待ってから再度お試しください。',
  failed: '取得に失敗しました。時間をおいて再度お試しください。',
  network: '通信状況を確認して再度お試しください。',
} as const

function buildDisplayRankings(rankings: RankingItem[] | undefined): RankingItem[] {
  if (!Array.isArray(rankings)) {
    return []
  }

  return rankings.slice(0, MAX_RANKING_LIMIT)
}

/**
 * ユーザー向け文言のみ返し、内部エラー詳細は画面に出さない。
 */
function resolveRankingErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.status === HTTP_STATUS.TOO_MANY_REQUESTS) {
      return RANKING_ERROR_MESSAGES.rateLimited
    }

    if (error.status === 0) {
      return RANKING_ERROR_MESSAGES.network
    }
  }

  return RANKING_ERROR_MESSAGES.failed
}

export function RankingSection({
  myPostIds,
  onSelectRankingPost,
  polling = false,
}: RankingSectionProps) {
  const { data, isLoading, isError, error } = useRankings(DEFAULT_RANKING_LIMIT, {
    polling,
  })
  const displayRankings = buildDisplayRankings(data?.rankings)
  const myPostIdSet = new Set(myPostIds)

  return (
    <section
      id="ranking-section"
      role="region"
      aria-label="ランキング表示エリア"
      className="rounded border p-4"
    >
      <h2 className="mb-4 text-lg font-semibold">ランキング</h2>

      {isLoading && <p>ランキングを読み込み中です...</p>}

      {isError && <p>{resolveRankingErrorMessage(error)}</p>}

      {!isLoading && !isError && displayRankings.length === 0 && <p>ランキングはまだありません</p>}

      {!isLoading && !isError && displayRankings.length > 0 && (
        <ol className="space-y-2">
          {displayRankings.map((item) => {
            const isMyPost = myPostIdSet.has(item.id)
            return (
              <li key={item.id}>
                <button
                  type="button"
                  data-testid="ranking-item"
                  className={`w-full rounded border p-3 text-left ${isMyPost ? 'bg-yellow-100 border-l-4 border-l-red-500' : ''}`}
                  onClick={() => onSelectRankingPost(item.id)}
                >
                  <p className="font-semibold">
                    {item.rank}位 {item.nickname}
                  </p>
                  <p>{item.body}</p>
                  <p className="text-sm text-gray-600">平均スコア: {item.average_score.toFixed(1)}</p>
                  {isMyPost && <p className="text-sm font-bold">あなたの投稿</p>}
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
