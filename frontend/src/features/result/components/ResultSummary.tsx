import { useState } from 'react'

interface ResultSummaryProps {
  nickname: string
  body: string
  rank?: number
  totalCount?: number
  averageScore?: number
  status: 'scored' | 'failed'
  onClose: () => void
  closeLabel?: string
  closeAriaLabel?: string
  closeIcon?: string
  onRejudge?: () => void
  isRejudging?: boolean
  rejudgeErrorMessage?: string
  onShareToX?: () => void
  ogpPreviewUrl?: string
}

const FAILED_AVERAGE_LABEL = '--.-'
const FAILED_RANK_DISPLAY = '---位'

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function ResultSummary({
  nickname,
  body,
  rank,
  averageScore,
  status,
  onClose,
  closeLabel = 'トップへ',
  closeAriaLabel = 'トップへ',
  closeIcon = '🏮',
  onRejudge,
  isRejudging = false,
  rejudgeErrorMessage = '',
  onShareToX,
  ogpPreviewUrl,
}: ResultSummaryProps) {
  const [isOgpPreviewVisible, setIsOgpPreviewVisible] = useState(false)
  const canRejudge = status === 'failed' && typeof onRejudge === 'function'
  const canPreviewOgp = typeof ogpPreviewUrl === 'string' && ogpPreviewUrl.length > 0
  const rankLabel = status === 'scored' && isFiniteNumber(rank) ? `${rank}位` : FAILED_RANK_DISPLAY
  const averageLabel =
    status === 'scored' && isFiniteNumber(averageScore)
      ? averageScore.toFixed(1)
      : FAILED_AVERAGE_LABEL

  return (
    <section
      className="glass-panel relative z-20 mx-auto w-full max-w-xl rounded-2xl border border-amber-200/35 p-5 shadow-[0_18px_40px_rgba(8,15,40,0.35)]"
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

      <div className="result-summary-stats mt-5">
        <p className="result-summary-stat result-summary-rank-line">
          <span className="sr-only">{`順位 ${rankLabel}`}</span>
          <span className="result-summary-label">順位</span>
          <span className="result-summary-value">{rankLabel}</span>
        </p>
        <p className="result-summary-stat result-summary-score-line">
          <span className="sr-only">{`スコア: ${averageLabel}`}</span>
          <span className="result-summary-label">スコア:</span>
          <span className="result-summary-value">{averageLabel}</span>
        </p>
      </div>

      {canPreviewOgp && isOgpPreviewVisible && (
        <div className="mt-6 rounded-2xl border border-cyan-200/30 bg-slate-950/35 p-4">
          <p className="mb-3 text-sm font-bold tracking-[0.08em] text-cyan-100">
            シェア画像プレビュー
          </p>
          <img
            src={ogpPreviewUrl}
            alt={`${nickname}さんのOGP画像プレビュー`}
            data-testid="ogp-preview"
            className="h-auto w-full rounded-xl border border-white/15 object-cover shadow-[0_16px_32px_rgba(15,23,42,0.32)]"
          />
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {canPreviewOgp && (
          <button
            type="button"
            onClick={() => setIsOgpPreviewVisible((prev) => !prev)}
            aria-expanded={isOgpPreviewVisible}
            aria-label={isOgpPreviewVisible ? 'シェア画像を閉じる' : 'シェア画像を表示'}
            className="neon-button-base result-summary-back-button result-summary-share-image-button mt-0.5 px-6 py-2.5 text-sm sm:text-base font-black tracking-[0.07em]"
          >
            <span aria-hidden="true" className="result-summary-back-icon">
              🖼
            </span>
            {isOgpPreviewVisible ? 'シェア画像を閉じる' : 'シェア画像'}
          </button>
        )}
        {typeof onShareToX === 'function' && (
          <button
            type="button"
            onClick={onShareToX}
            aria-label="Xでシェア"
            className="neon-button-base result-summary-back-button result-summary-x-share-button mt-0.5 px-6 py-2.5 text-sm sm:text-base font-black tracking-[0.07em]"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="result-summary-back-icon mr-2 h-[1.05rem] w-[1.05rem] fill-current"
            >
              <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.847h-7.406l-5.8-7.584-6.639 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932zM17.61 20.644h2.039L6.486 3.24H4.298z" />
            </svg>
            <span>でシェア</span>
          </button>
        )}
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
        <button
          type="button"
          onClick={onClose}
          aria-label={closeAriaLabel}
          className="neon-button-base result-summary-back-button mt-0.5 px-6 py-2.5 text-sm sm:text-base font-black tracking-[0.07em]"
        >
          <span aria-hidden="true" className="result-summary-back-icon">
            {closeIcon}
          </span>
          <span>{closeLabel}</span>
        </button>
      </div>
      {rejudgeErrorMessage && (
        <p className="mt-3 text-center text-sm font-semibold text-rose-200">
          {rejudgeErrorMessage}
        </p>
      )}
    </section>
  )
}
