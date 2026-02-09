/** 審査員ペルソナ */
export type JudgePersona = 'hiroyuki' | 'dewi' | 'nakao';

/** 投稿ステータス */
export type PostStatus = 'judging' | 'scored' | 'failed';

/** 審査結果 */
export interface Judgment {
  persona: JudgePersona;
  /** 合計スコア (0-100) */
  total_score: number;
  /** 共感度 (0-20) */
  empathy: number;
  /** 面白さ (0-20) */
  humor: number;
  /** 簡潔さ (0-20) */
  brevity: number;
  /** 独創性 (0-20) */
  originality: number;
  /** 表現力 (0-20) */
  expression: number;
  /** 審査員コメント */
  comment: string;
  /** 審査成功フラグ */
  success: boolean;
}

/** 投稿データ */
export interface Post {
  /** 投稿ID (UUID) */
  id: string;
  /** ニックネーム (1-20文字) */
  nickname: string;
  /** 投稿本文 (3-30文字) */
  body: string;
  /** 投稿ステータス */
  status: PostStatus;
  /** 平均スコア (0-100, 審査完了後に設定) */
  average_score?: number;
  /** ランキング順位 (審査完了後に設定) */
  rank?: number;
  /** 総投稿数 */
  total_count?: number;
  /** 審査結果配列 */
  judgments?: Judgment[];
  /** 作成日時 (ISO 8601形式: 例 2026-02-09T12:00:00Z) */
  created_at: string;
}

/** ランキング項目 */
export interface RankingItem {
  /** 順位 */
  rank: number;
  /** 投稿ID */
  id: string;
  /** ニックネーム */
  nickname: string;
  /** 投稿本文 */
  body: string;
  /** 平均スコア */
  average_score: number;
}
