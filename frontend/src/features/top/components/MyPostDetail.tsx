import type { Post } from '../../../shared/types/domain'

type Props = {
  post: Post
  onBack: () => void
  onClose: () => void
}

const STATUS_LABELS: Record<Post['status'], string> = {
  judging: '審査中',
  scored: '審査完了',
  failed: '審査失敗',
}

export function MyPostDetail({ post, onBack, onClose }: Props) {
  return (
    <section aria-label="投稿詳細">
      <div className="modal-header-gorgeous flex items-center justify-between gap-4">
        <h2 className="gold-text text-lg font-semibold">投稿詳細</h2>
        <button
          type="button"
          onClick={onClose}
          className="modal-close-gorgeous"
          aria-label="閉じる"
        >
          <span aria-hidden="true" className="leading-none text-lg">
            ×
          </span>
          <span className="sr-only">閉じる</span>
        </button>
      </div>
      <dl className="space-y-2">
        <div>
          <dt className="font-semibold text-amber-100">ニックネーム</dt>
          <dd>{post.nickname}</dd>
        </div>
        <div>
          <dt className="font-semibold text-amber-100">本文</dt>
          <dd>{post.body}</dd>
        </div>
        <div>
          <dt className="font-semibold text-amber-100">ステータス</dt>
          <dd>{STATUS_LABELS[post.status]}</dd>
        </div>
        {typeof post.average_score === 'number' && (
          <div>
            <dt className="font-semibold text-amber-100">スコア</dt>
            <dd>{post.average_score.toFixed(1)}</dd>
          </div>
        )}
        {typeof post.rank === 'number' && (
          <div>
            <dt className="font-semibold text-amber-100">順位</dt>
            <dd>{post.rank}位</dd>
          </div>
        )}
      </dl>

      {Array.isArray(post.judgments) && post.judgments.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 font-semibold text-amber-100">審査結果</h3>
          <ul className="space-y-2">
            {post.judgments.map((judgment, index) => (
              <li
                key={`${judgment.persona}-${index}`}
                className="rounded-xl border border-amber-200/25 bg-black/15 p-2"
              >
                <p>{judgment.persona}</p>
                <p>スコア: {judgment.total_score}</p>
                <p>{judgment.comment}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-amber-200/35 bg-black/20 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:bg-black/30"
        >
          戻る
        </button>
      </div>
    </section>
  )
}
