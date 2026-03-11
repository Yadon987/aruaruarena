import { HTTP_STATUS } from '../../../shared/constants/api'
import { DEFAULT_RANKING_LIMIT, MAX_RANKING_LIMIT } from '../../../shared/constants/query'
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

const RANKING_ROW_CLASS =
  'relative w-full overflow-hidden cursor-pointer rounded-xl border p-3 text-left transition duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 hover:-translate-y-1 hover:bg-white/5 hover:shadow-[0_18px_35px_rgba(255,214,120,0.25)]'
const RANKING_ROW_STYLE_BY_RANK: Record<number, string> = {
  1: 'bg-gradient-to-br from-amber-200/55 via-amber-100/30 to-black/20 border-amber-200/90 shadow-[0_24px_50px_rgba(251,191,36,0.42)] ring-2 ring-amber-200/45',
  2: 'bg-gradient-to-br from-amber-300/28 via-amber-200/18 to-black/20 border-amber-200/70 shadow-[0_18px_38px_rgba(251,191,36,0.24)]',
  3: 'bg-gradient-to-br from-amber-100/26 via-amber-300/12 to-black/22 border-amber-300/55 shadow-[0_14px_34px_rgba(250,204,21,0.22)]',
} as const
const RANKING_BADGE_CLASS_BY_RANK: Record<number, string> = {
  1: 'bg-amber-200 text-amber-950',
  2: 'bg-amber-100 text-amber-900',
  3: 'bg-amber-300/80 text-amber-950',
} as const
const RANKING_BADGE_CLASS_DEFAULT = 'bg-white/10 text-slate-100'
const TOP3_ICONS: Record<number, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
}
const TOP3_ROW_CLASSES: Record<number, string> = {
  1: 'ranking-top-rank-row ranking-top-rank-row-1 pr-14',
  2: 'ranking-top-rank-row ranking-top-rank-row-2 pr-14',
  3: 'ranking-top-rank-row ranking-top-rank-row-3 pr-14',
}
const TOP3_ICON_CLASSES: Record<number, string> = {
  1: 'ranking-top-rank-icon ranking-top-rank-icon-1',
  2: 'ranking-top-rank-icon ranking-top-rank-icon-2',
  3: 'ranking-top-rank-icon ranking-top-rank-icon-3',
}

function getRankingRowClass(rank: number, isMyPost: boolean) {
  const podiumClass = rank <= 3 ? RANKING_ROW_STYLE_BY_RANK[rank] : ''
  const highlightClass =
    isMyPost && rank > 3
      ? 'border-amber-200/60 bg-amber-100/15 shadow-[inset_4px_0_0_rgba(251,191,36,0.9)]'
      : ''

  return `${RANKING_ROW_CLASS} ${podiumClass} ${highlightClass}`.trim()
}

function getRankingBadgeClass(rank: number) {
  if (rank <= 3) {
    return `border ${RANKING_BADGE_CLASS_BY_RANK[rank]} border-white/35`
  }

  return `border border-white/25 ${RANKING_BADGE_CLASS_DEFAULT}`
}

function getRankingTop3Icon(rank: number) {
  return TOP3_ICONS[rank] ?? ''
}

function getRankingTop3RowClass(rank: number) {
  return TOP3_ROW_CLASSES[rank] ?? ''
}

function getRankingTop3IconClass(rank: number) {
  return TOP3_ICON_CLASSES[rank] ?? TOP3_ICON_CLASSES[3]
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

  const handleSelectRankingPost = (postId: string) => {
    onSelectRankingPost(postId)
  }

  return (
    <section
      id="ranking-section"
      aria-label="ランキング表示エリア"
      className="rounded-2xl border border-amber-200/25 bg-black/15 p-4"
    >
      <h2 className="mb-4 text-lg font-semibold text-amber-100">ランキング</h2>

      {isLoading && <p className="text-slate-100">ランキングを読み込み中です...</p>}

      {isError && <p className="text-rose-200">{resolveRankingErrorMessage(error)}</p>}

      {!isLoading && !isError && displayRankings.length === 0 && (
        <p className="text-slate-100">ランキングはまだありません</p>
      )}

      {!isLoading && !isError && displayRankings.length > 0 && (
        <ol className="space-y-2">
          {displayRankings.map((item) => {
            const isMyPost = myPostIdSet.has(item.id)
            const isTopRank = item.rank <= 3
            return (
              <li key={item.id}>
                <button
                  type="button"
                  data-testid="ranking-item"
                  className={`${getRankingRowClass(item.rank, isMyPost)} bg-black/10 text-slate-100 ${getRankingTop3RowClass(item.rank)}`}
                  onClick={() => handleSelectRankingPost(item.id)}
                  aria-label={`${item.rank}位 ${item.nickname} 採点の詳細を確認`}
                >
                  {isTopRank && (
                    <span
                      className={`pointer-events-none z-10 border border-amber-100/35 bg-black/25 ${getRankingTop3IconClass(item.rank)} ranking-top-rank-tag font-black text-amber-100/90`}
                    >
                      {getRankingTop3Icon(item.rank)}
                    </span>
                  )}
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className={`flex h-8 min-w-8 items-center justify-center rounded-full text-sm font-black ${getRankingBadgeClass(item.rank)}`}
                    >
                      {`${item.rank}位`}
                    </span>
                    <p className="font-semibold text-amber-100">{item.nickname}</p>
                  </div>
                  <p className="mt-1 text-slate-100">{item.body}</p>
                  <p className="text-sm text-slate-300">
                    <span className="inline-flex items-center rounded-full border border-amber-200/35 bg-amber-100/10 px-2.5 py-1 text-xs font-black uppercase tracking-[0.16em] text-amber-100/85">
                      SCORE
                    </span>
                    <span className="ml-2 font-mono text-xl font-black tracking-tight text-amber-100">
                      {item.average_score.toFixed(1)}
                    </span>
                  </p>
                  {isMyPost && <p className="text-sm font-bold text-amber-200">あなたの投稿</p>}
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
