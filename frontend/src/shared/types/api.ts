import type { Post, RankingItem, PostStatus } from './domain'

/**
 * 共通エラーレスポンス
 *
 * APIエラー発生時に返される標準エラーフォーマットです。
 *
 * @property error - エラーメッセージ（日本語）
 * @property code - エラーコード（例: RATE_LIMITED, VALIDATION_ERROR, INTERNAL_ERROR）
 */
export interface ApiError {
  error: string
  code: string
}

/**
 * 投稿作成リクエスト
 *
 * 新しい「あるある」投稿を作成するためのリクエストボディです。
 *
 * @property nickname - ニックネーム（1-20文字）
 * @property body - 投稿本文（3-30文字）
 */
export interface CreatePostRequest {
  nickname: string
  body: string
}

/**
 * 投稿作成レスポンス
 *
 * 投稿作成成功時に返されるレスポンスです。
 *
 * @property id - 作成された投稿ID（UUID）
 * @property status - 初期ステータス（常に 'judging'）
 */
export interface CreatePostResponse {
  id: string
  status: PostStatus
}

/**
 * 投稿取得レスポンス
 *
 * 投稿詳細情報を取得するための型です。
 */
export type GetPostResponse = Post

/**
 * ランキング取得レスポンス
 *
 * ランキング情報を取得するための型です。
 *
 * @property rankings - TOP20のランキング配列
 * @property total_count - 全投稿数
 */
export interface GetRankingResponse {
  rankings: RankingItem[]
  total_count: number
}
