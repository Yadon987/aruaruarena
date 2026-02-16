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
      <h2 className="mb-3 text-lg font-semibold">投稿詳細</h2>
      <dl className="space-y-2">
        <div>
          <dt className="font-semibold">ニックネーム</dt>
          <dd>{post.nickname}</dd>
        </div>
        <div>
          <dt className="font-semibold">本文</dt>
          <dd>{post.body}</dd>
        </div>
        <div>
          <dt className="font-semibold">ステータス</dt>
          <dd>{STATUS_LABELS[post.status]}</dd>
        </div>
        {typeof post.average_score === 'number' && (
          <div>
            <dt className="font-semibold">平均スコア</dt>
            <dd>{post.average_score.toFixed(1)}</dd>
          </div>
        )}
        {typeof post.rank === 'number' && (
          <div>
            <dt className="font-semibold">順位</dt>
            <dd>{post.rank}位</dd>
          </div>
        )}
      </dl>

      {Array.isArray(post.judgments) && post.judgments.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 font-semibold">審査結果</h3>
          <ul className="space-y-2">
            {post.judgments.map((judgment) => (
              <li key={judgment.persona} className="rounded border p-2">
                <p>{judgment.persona}</p>
                <p>スコア: {judgment.total_score}</p>
                <p>{judgment.comment}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button type="button" onClick={onBack}>
          戻る
        </button>
        <button type="button" onClick={onClose}>
          閉じる
        </button>
      </div>
    </section>
  )
}
