import { type CSSProperties, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion'
import type { OgpStatus } from '../../../shared/types/domain'

interface ResultSummaryProps {
  nickname: string
  body: string
  rank?: number
  totalCount?: number
  averageScore?: number
  status: 'scored' | 'failed'
  isHighScore?: boolean
  onClose: () => void
  closeLabel?: string
  closeAriaLabel?: string
  closeIcon?: string
  onRejudge?: () => void
  isRejudging?: boolean
  rejudgeErrorMessage?: string
  showShareActions?: boolean
  ogpStatus?: OgpStatus | null
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
  isHighScore = false,
  onClose,
  closeLabel = 'トップへ',
  closeAriaLabel,
  closeIcon = '🏮',
  onRejudge,
  isRejudging = false,
  rejudgeErrorMessage = '',
  showShareActions = false,
  ogpStatus = null,
  onShareToX,
  ogpPreviewUrl,
}: ResultSummaryProps) {
  const [isOgpPreviewVisible, setIsOgpPreviewVisible] = useState(false)
  const prefersReducedMotion = useReducedMotion()
  const resolvedCloseAriaLabel = closeAriaLabel ?? closeLabel
  const canRejudge = status === 'failed' && typeof onRejudge === 'function'
  const isSharePreparing = showShareActions && ogpStatus !== 'ready'
  const canPreviewOgp =
    showShareActions && typeof ogpPreviewUrl === 'string' && ogpPreviewUrl.length > 0
  const actionCount =
    (canPreviewOgp ? 1 : 0) +
    (isSharePreparing ? 1 : 0) +
    (typeof onShareToX === 'function' ? 1 : 0) +
    (canRejudge ? 1 : 0) +
    1
  const rankLabel = status === 'scored' && isFiniteNumber(rank) ? `${rank}位` : FAILED_RANK_DISPLAY
  const averageLabel =
    status === 'scored' && isFiniteNumber(averageScore)
      ? averageScore.toFixed(1)
      : FAILED_AVERAGE_LABEL
  const confettiPieces = useMemo(() => {
    const count = prefersReducedMotion ? 14 : 36

    return Array.from({ length: count }, (_, index) => (
      <span
        key={`confetti-piece-${index}`}
        className={`result-summary-confetti-piece result-summary-confetti-piece-${
          (index % 4) + 1
        } ${index % 2 === 0 ? 'result-summary-confetti-piece-left' : 'result-summary-confetti-piece-right'}`}
        style={
          {
            ['--confetti-left' as string]: `${2 + (index % 12) * 8.2}%`,
            ['--confetti-top' as string]: `${-18 - (index % 6) * 13}%`,
            ['--confetti-drift' as string]: `${index % 2 === 0 ? -1 : 1}`,
            ['--confetti-delay' as string]: `${(index % 8) * 0.18}s`,
            ['--confetti-duration' as string]: `${6.2 + (index % 6) * 0.55}s`,
            ['--confetti-rotate' as string]: `${260 + (index % 5) * 44}deg`,
            ['--confetti-scale' as string]: `${0.96 + (index % 4) * 0.2}`,
          } as CSSProperties
        }
      />
    ))
  }, [prefersReducedMotion])
  const confettiLayer = useMemo(() => {
    if (!isHighScore || typeof document === 'undefined') return null

    return createPortal(
      <div
        aria-hidden="true"
        data-testid="high-score-confetti"
        className={`result-summary-confetti-layer ${
          prefersReducedMotion ? 'result-summary-confetti-layer-reduced' : ''
        }`}
      >
        {confettiPieces}
      </div>,
      document.body
    )
  }, [confettiPieces, isHighScore, prefersReducedMotion])

  return (
    <section
      className={`glass-panel result-summary-shell relative z-20 mx-auto w-full max-w-xl rounded-2xl border border-amber-200/35 p-4 lg:p-5 shadow-[0_18px_40px_rgba(8,15,40,0.35)] ${
        isHighScore ? 'result-summary-shell-high-score' : ''
      }`}
      aria-label="審査結果サマリー"
    >
      {isHighScore && (
        <>
          {confettiLayer}
          <div
            aria-hidden="true"
            data-testid="high-score-flash"
            className={`result-summary-flash ${prefersReducedMotion ? 'result-summary-flash-reduced' : ''}`}
          />
        </>
      )}
      <div className="result-summary-content relative z-20">
        <h2 className="text-center text-2xl font-black text-white lg:text-3xl">
          ★ <span className="gold-text">{nickname}</span> ★
        </h2>
        <p className="mt-3 text-center text-sm leading-relaxed text-slate-100 lg:text-base">
          「{body}」
        </p>

        <div className="result-summary-stats mt-4 lg:mt-5">
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
          <div className="mt-5 rounded-2xl border border-cyan-200/30 bg-slate-950/35 p-4 lg:mt-6">
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

        <div
          data-testid="result-summary-actions"
          className={`result-summary-actions result-summary-actions-count-${actionCount} mt-5 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 lg:mt-6`}
        >
          {canPreviewOgp && (
            <button
              type="button"
              onClick={() => setIsOgpPreviewVisible((prev) => !prev)}
              aria-expanded={isOgpPreviewVisible}
              aria-label={isOgpPreviewVisible ? 'シェア画像を閉じる' : 'シェア画像を表示'}
              className="neon-button-base neon-button-compact-mobile result-summary-action-button result-summary-back-button result-summary-share-image-button result-summary-share-image-button-enter mt-0.5 px-6 py-2.5 text-sm sm:text-base font-black tracking-[0.07em]"
            >
              <span aria-hidden="true" className="result-summary-back-icon">
                📷
              </span>
              {isOgpPreviewVisible ? 'シェア画像を閉じる' : 'シェア画像'}
            </button>
          )}
          {showShareActions && isSharePreparing && (
            <button
              type="button"
              disabled={true}
              aria-label="画像を準備中"
              className="neon-button-base neon-button-compact-mobile result-summary-action-button result-summary-back-button result-summary-share-pending-button mt-0.5 px-6 py-2.5 text-sm sm:text-base font-black tracking-[0.07em]"
            >
              <span aria-hidden="true" className="result-summary-share-spinner" />
              <span>画像を準備中</span>
            </button>
          )}
          {typeof onShareToX === 'function' && (
            <button
              type="button"
              onClick={onShareToX}
              aria-label="Xでシェアする"
              className="neon-button-base neon-button-compact-mobile result-summary-action-button result-summary-back-button result-summary-x-share-button mt-0.5 px-6 py-2.5 text-sm sm:text-base font-black tracking-[0.07em]"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="result-summary-back-icon mr-2 h-[1.05rem] w-[1.05rem] fill-current"
              >
                <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.847h-7.406l-5.8-7.584-6.639 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932zM17.61 20.644h2.039L6.486 3.24H4.298z" />
              </svg>
              <span>Xでシェアする</span>
            </button>
          )}
          {canRejudge && (
            <button
              type="button"
              onClick={onRejudge}
              aria-label="再審査する"
              disabled={isRejudging}
              className="neon-button-base neon-button-compact-mobile result-summary-action-button neon-glow-pink px-7 py-3 text-base font-black tracking-wide disabled:cursor-not-allowed disabled:opacity-60 sm:px-8"
            >
              {isRejudging ? '再審査中...' : '再審査する'}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={resolvedCloseAriaLabel}
            className="neon-button-base neon-button-compact-mobile result-summary-action-button result-summary-back-button mt-0.5 px-6 py-2.5 text-sm sm:text-base font-black tracking-[0.07em]"
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
      </div>
    </section>
  )
}
