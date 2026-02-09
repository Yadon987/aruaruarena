import { JUDGE, POST_STATUS } from '@shared/constants/validation'

/**
 * 審査員ペルソナ
 *
 * 定数から導出されるリテラル型
 */
export type JudgePersona = (typeof JUDGE.PERSONAS)[number]

/**
 * 投稿ステータス
 *
 * 定数から導出されるリテラル型
 */
export type PostStatus = (typeof POST_STATUS.VALUES)[number]

/**
 * 審査結果
 *
 * 審査員による「あるある」投稿の採点結果を表します。
 *
 * @property persona - 審査員ペルソナ ('hiroyuki' | 'dewi' | 'nakao')
 * @property total_score - 合計スコア (0-100)
 * @property empathy - 共感度 (0-20)
 * @property humor - 面白さ (0-20)
 * @property brevity - 簡潔さ (0-20)
 * @property originality - 独創性 (0-20)
 * @property expression - 表現力 (0-20)
 * @property comment - 審査員コメント
 * @property success - 審査成功フラグ
 */
export interface Judgment {
  persona: JudgePersona
  total_score: number
  empathy: number
  humor: number
  brevity: number
  originality: number
  expression: number
  comment: string
  success: boolean
}

/**
 * 投稿データ
 *
 * ユーザーが投稿した「あるある」の情報と審査結果を含みます。
 *
 * @property id - 投稿ID (UUID)
 * @property nickname - ニックネーム (1-20文字)
 * @property body - 投稿本文 (3-30文字)
 * @property status - 投稿ステータス ('judging' | 'scored' | 'failed')
 * @property average_score - 平均スコア (0-100, 審査完了後に設定)
 * @property rank - ランキング順位 (審査完了後に設定)
 * @property total_count - 総投稿数
 * @property judgments - 審査結果配列
 * @property created_at - 作成日時 (ISO 8601形式: 例 2026-02-09T12:00:00Z)
 */
export interface Post {
  id: string
  nickname: string
  body: string
  status: PostStatus
  average_score?: number
  rank?: number
  total_count?: number
  judgments?: Judgment[]
  created_at: string
}

/**
 * ランキング項目
 *
 * ランキング画面に表示される投稿情報を表します。
 *
 * @property rank - 順位
 * @property id - 投稿ID
 * @property nickname - ニックネーム
 * @property body - 投稿本文
 * @property average_score - 平均スコア
 */
export interface RankingItem {
  rank: number
  id: string
  nickname: string
  body: string
  average_score: number
}
