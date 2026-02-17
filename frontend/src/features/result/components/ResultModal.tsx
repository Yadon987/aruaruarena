import { KeyboardEvent, useEffect, useMemo, useRef } from 'react'
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion'
import type { Post } from '../../../shared/types/domain'
import { JudgeResultCard } from './JudgeResultCard'

type Props = {
  isOpen: boolean
  post: Post | null
  isLoading: boolean
  errorCode: string | null
  onRetry: () => void
  onClose: () => void
}

const ERROR_CODE_NOT_FOUND = 'NOT_FOUND'
const KEY_ESCAPE = 'Escape'
const KEY_TAB = 'Tab'
const MODAL_FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
const MESSAGE_NOT_FOUND = '投稿が見つかりません'
const MESSAGE_FETCH_FAILED = '投稿詳細の取得に失敗しました'
const MESSAGE_LOADING = '読み込み中...'
const MESSAGE_RANK_FALLBACK = '順位情報を取得できませんでした'
const MESSAGE_FAILED_RANK = '順位: ---'
const MESSAGE_NO_JUDGMENTS = '審査結果はまだありません'

function resolveErrorMessage(errorCode: string | null): string {
  if (errorCode === ERROR_CODE_NOT_FOUND) {
    return MESSAGE_NOT_FOUND
  }
  return MESSAGE_FETCH_FAILED
}

function isRankInfoAvailable(post: Post | null): boolean {
  return typeof post?.rank === 'number' && typeof post?.total_count === 'number'
}

function hasJudgeResults(post: Post | null): boolean {
  return Array.isArray(post?.judgments) && post.judgments.length > 0
}

export function ResultModal({ isOpen, post, isLoading, errorCode, onRetry, onClose }: Props) {
  const modalRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const prefersReducedMotion = useReducedMotion()

  const hasRankInfo = isRankInfoAvailable(post)
  const shouldShowScoredFallback = post?.status === 'scored' && !hasRankInfo
  const shouldShowFailedRank = post?.status === 'failed'
  const hasJudgments = hasJudgeResults(post)

  const focusableSelector = useMemo(() => MODAL_FOCUSABLE_SELECTOR, [])

  useEffect(() => {
    if (!isOpen) return
    closeButtonRef.current?.focus()
  }, [isOpen])

  if (!isOpen) return null

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === KEY_ESCAPE) {
      onClose()
      return
    }

    if (event.key !== KEY_TAB) return
    const focusableElements = Array.from(
      modalRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? []
    )
    if (focusableElements.length === 0) return

    const first = focusableElements[0]
    const last = focusableElements[focusableElements.length - 1]
    const active = document.activeElement

    // Shift+Tab/Tab でモーダルの先頭・末尾を跨ぐ場合は循環させる。
    if (event.shiftKey && active === first) {
      event.preventDefault()
      last.focus()
      return
    }
    if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="審査結果モーダル"
        className="w-full max-w-2xl rounded bg-white p-4 max-h-[90vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
        style={prefersReducedMotion ? { transitionDuration: '0ms' } : undefined}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">審査結果</h2>
          <button ref={closeButtonRef} type="button" onClick={onClose}>
            閉じる
          </button>
        </div>

        {isLoading && !post && <p>{MESSAGE_LOADING}</p>}

        {!isLoading && errorCode && (
          <div>
            <p>{resolveErrorMessage(errorCode)}</p>
            <button type="button" onClick={onRetry} className="mt-2">
              再試行
            </button>
          </div>
        )}

        {!isLoading && !errorCode && post && (
          <div>
            <dl className="space-y-2">
              <div>
                <dt className="font-semibold">ニックネーム</dt>
                <dd>{post.nickname}</dd>
              </div>
              <div>
                <dt className="font-semibold">本文</dt>
                <dd>{post.body}</dd>
              </div>
              {typeof post.average_score === 'number' && (
                <div>
                  <dt className="font-semibold">平均点</dt>
                  <dd>平均点: {post.average_score.toFixed(1)}</dd>
                </div>
              )}
              {post.status === 'scored' && hasRankInfo && (
                <div>
                  <dt className="font-semibold">順位</dt>
                  <dd>
                    {post.rank}位 / {post.total_count}件中
                  </dd>
                </div>
              )}
              {shouldShowScoredFallback && <p>{MESSAGE_RANK_FALLBACK}</p>}
              {shouldShowFailedRank && <p>{MESSAGE_FAILED_RANK}</p>}
            </dl>

            <section className="mt-4">
              <h3 className="mb-2 font-semibold">審査員コメント</h3>
              {hasJudgments ? (
                <div className="space-y-2">
                  {post.judgments!.map((judgment) => (
                    <JudgeResultCard key={judgment.persona} judgment={judgment} />
                  ))}
                </div>
              ) : (
                <p>{MESSAGE_NO_JUDGMENTS}</p>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
