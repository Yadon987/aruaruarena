import type { Post, RankingItem, PostStatus } from './domain';

/** 共通エラーレスポンス */
export interface ApiError {
  /** エラーメッセージ */
  error: string;
  /** エラーコード (例: RATE_LIMITED, VALIDATION_ERROR) */
  code: string;
}

/** 投稿作成リクエスト */
export interface CreatePostRequest {
  /** ニックネーム (1-20文字) */
  nickname: string;
  /** 投稿本文 (3-30文字) */
  body: string;
}

/** 投稿作成レスポンス */
export interface CreatePostResponse {
  /** 作成された投稿ID */
  id: string;
  /** 初期ステータス (常に 'judging') */
  status: PostStatus;
}

/** 投稿取得レスポンス */
export type GetPostResponse = Post;

/** ランキング取得レスポンス */
export interface GetRankingResponse {
  /** TOP20のランキング配列 */
  rankings: RankingItem[];
  /** 全投稿数 */
  total_count: number;
}
