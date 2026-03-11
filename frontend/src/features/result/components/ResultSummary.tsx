interface ResultSummaryProps {
  nickname: string
  body: string
  rank?: number
  totalCount?: number
  averageScore?: number
  status: 'scored' | 'failed'
  onShare: () => void
  onClose: () => void
  onRejudge?: () => void
  isRejudging?: boolean
  rejudgeErrorMessage?: string
  isSharePending?: boolean
  shareStatusMessage?: string
}

const FAILED_RANK_LABEL = '第---位'
const FAILED_AVERAGE_LABEL = '--.-'
const FAILED_TOTAL_LABEL = '集計対象外'

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function ResultSummary({
  nickname,
  body,
  rank,
  totalCount,
  averageScore,
  status,
  onShare,
  onClose,
  onRejudge,
  isRejudging = false,
  rejudgeErrorMessage = '',
  isSharePending = false,
  shareStatusMessage = '',
}: ResultSummaryProps) {
  const canShare = status === 'scored' && typeof rank === 'number' && rank <= 20
  const canRejudge = status === 'failed' && typeof onRejudge === 'function'
  const rankLabel =
    status === 'scored' && typeof rank === 'number' ? `第${rank}位` : FAILED_RANK_LABEL
  const totalLabel =
    status === 'scored' && typeof totalCount === 'number' ? `${totalCount}件中` : FAILED_TOTAL_LABEL
  const averageLabel =
    status === 'scored' && isFiniteNumber(averageScore)
      ? averageScore.toFixed(1)
      : FAILED_AVERAGE_LABEL

  return (
    <section
      className="glass-panel relative z-20 mx-auto w-full max-w-xl rounded-2xl border border-white/20 p-5 shadow-[0_18px_40px_rgba(8,15,40,0.35)]"
      aria-label="審査結果サマリー"
    >
      <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/85">
        RESULT
      </p>
      <h2 className="mt-2 text-center text-2xl font-black text-white sm:text-3xl">
        ★ <span className="gold-text">{nickname}</span> ★
      </h2>
      <p className="mt-3 text-center text-sm leading-relaxed text-slate-100 sm:text-base">
        「{body}」
      </p>

      <div className="mt-5 flex flex-wrap items-end justify-center gap-x-6 gap-y-2 text-white">
        <p className="text-sm font-semibold sm:text-base">
          <span className="digital-score gold-text text-2xl">{rankLabel}</span>
          <span className="ml-2 text-slate-100">{totalLabel}</span>
        </p>
        <p className="text-sm font-semibold sm:text-base">
          <span className="sr-only">{`平均点: ${averageLabel}`}</span>
          平均点: <span className="digital-score gold-text text-2xl">{averageLabel}</span>
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {canRejudge && (
          <button
            type="button"
            onClick={onRejudge}
            aria-label="再審査する"
            disabled={isRejudging}
            className="neon-button-base neon-glow-pink px-7 py-3 text-base font-black tracking-wide disabled:cursor-not-allowed disabled:opacity-60 sm:px-8"
          >
            {isRejudging ? '再審査中...' : '再審査する'}
          </button>
        )}
        {canShare && (
          <button
            type="button"
            onClick={onShare}
            aria-label="Xでシェア"
            disabled={isSharePending}
            className="neon-button-base neon-glow-pink px-7 py-3 text-base font-black tracking-wide disabled:cursor-not-allowed disabled:opacity-60 sm:px-8"
          >
            Xでシェア
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="トップへ戻る"
          className="rounded-full border border-white/40 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/15"
        >
          トップへ戻る
        </button>
      </div>
      {shareStatusMessage && (
        <p className="mt-3 text-center text-sm font-semibold text-cyan-100">
          {shareStatusMessage}
        </p>
      )}
      {rejudgeErrorMessage && (
        <p className="mt-3 text-center text-sm font-semibold text-rose-200">
          {rejudgeErrorMessage}
        </p>
      )}
    </section>
  )
}
