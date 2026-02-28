import { KeyboardEvent, useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion'
import { api } from '../../../shared/services/api'
import type { Post } from '../../../shared/types/domain'
import { JudgeResultCard } from './JudgeResultCard'

type Props = {
  isOpen: boolean
  post: Post | null
  isLoading: boolean
  errorCode: string | null
  onRetry: () => void
  onRejudgeSuccess: (post: Post) => void
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
const REJUDGE_BUTTON_LABEL = '再審査する'
const SHARE_BUTTON_LABEL = 'Xでシェア'
const SHARE_HASHTAG = '#あるあるアリーナ'
const SHARE_TARGET = '_blank'
const SHARE_WINDOW_FEATURES = 'noopener,noreferrer'
const SHARE_TOP_RANK_THRESHOLD = 20
const X_SHARE_BASE_URL = 'https://x.com/intent/tweet?text='
const MESSAGE_REJUDGE_FAILED = '再審査に失敗しました。時間をおいて再度お試しください'

// フロントエンドのベースURL（シェアURL生成用）
const FRONTEND_BASE_URL = import.meta.env.VITE_FRONTEND_BASE_URL || 'http://localhost:5173'

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

function canShowShareButton(post: Post | null): boolean {
  return (
    post?.status === 'scored' &&
    typeof post.rank === 'number' &&
    post.rank <= SHARE_TOP_RANK_THRESHOLD
  )
}

function buildShareUrl(postBody: string, postId: string): string {
  // OGP画像を表示するために投稿URLを含める
  const postUrl = `${FRONTEND_BASE_URL}/posts/${postId}`
  const shareText = `${postBody} ${SHARE_HASHTAG} ${postUrl}`
  // 本文、ハッシュタグ、URLに記号や空白が含まれても壊れないようURLエンコードする。
  return `${X_SHARE_BASE_URL}${encodeURIComponent(shareText)}`
}

export function ResultModal({
  isOpen,
  post,
  isLoading,
  errorCode,
  onRetry,
  onRejudgeSuccess,
  onClose,
}: Props) {
  const modalRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const prefersReducedMotion = useReducedMotion()
  const [isRejudging, setIsRejudging] = useState(false)
  const [isSharePreviewVisible, setIsSharePreviewVisible] = useState(false)
  const [rejudgeErrorMessage, setRejudgeErrorMessage] = useState('')

  const hasRankInfo = isRankInfoAvailable(post)
  const shouldShowScoredFallback = post?.status === 'scored' && !hasRankInfo
  const shouldShowFailedRank = post?.status === 'failed'
  const hasJudgments = hasJudgeResults(post)
  const canShowRejudge = post?.status === 'failed'
  const canShowShare = canShowShareButton(post)

  useEffect(() => {
    if (!isOpen) return
    closeButtonRef.current?.focus()
  }, [isOpen])

  useEffect(() => {
    setIsSharePreviewVisible(false)
    setRejudgeErrorMessage('')
  }, [post?.id, isOpen])

  if (!isOpen) return null

  const handleRejudge = async () => {
    if (!post || isRejudging) return
    setRejudgeErrorMessage('')
    setIsRejudging(true)
    try {
      const rejudgeResponse = await api.posts.rejudge(post.id)
      onRejudgeSuccess({ ...post, ...rejudgeResponse })
    } catch (error) {
      // 再審査失敗時はユーザーに再試行可能な状態と理由を明示する。
      setRejudgeErrorMessage(MESSAGE_REJUDGE_FAILED)
      console.error('再審査API呼び出しに失敗しました', error)
    } finally {
      setIsRejudging(false)
    }
  }

  const handleShare = () => {
    if (!post) return
    const shareUrl = buildShareUrl(post.body, post.id)
    setIsSharePreviewVisible(true)
    window.open(shareUrl, SHARE_TARGET, SHARE_WINDOW_FEATURES)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === KEY_ESCAPE) {
      onClose()
      return
    }

    if (event.key !== KEY_TAB) return
    const focusableElements = Array.from(
      modalRef.current?.querySelectorAll<HTMLElement>(MODAL_FOCUSABLE_SELECTOR) ?? []
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

  const handleBackdropKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === KEY_ESCAPE) {
      event.preventDefault()
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="モーダルを閉じる"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        onKeyDown={handleBackdropKeyDown}
      />
      <div className="relative flex h-full items-center justify-center p-4">
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
            </dl>
            {shouldShowScoredFallback && <p>{MESSAGE_RANK_FALLBACK}</p>}
            {shouldShowFailedRank && <p>{MESSAGE_FAILED_RANK}</p>}

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

            {(canShowRejudge || canShowShare) && (
              <section className="mt-4">
                <div className="flex gap-2">
                  {canShowRejudge && (
                    <button type="button" onClick={handleRejudge} disabled={isRejudging}>
                      {REJUDGE_BUTTON_LABEL}
                    </button>
                  )}
                  {canShowShare && (
                    <button type="button" onClick={handleShare}>
                      {SHARE_BUTTON_LABEL}
                    </button>
                  )}
                </div>
                {rejudgeErrorMessage && <p className="mt-2 text-red-600">{rejudgeErrorMessage}</p>}
                {isSharePreviewVisible && (
                  <div data-testid="ogp-preview" className="mt-2 rounded border p-2">
                    <p>{post.body}</p>
                  </div>
                )}
              </section>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
