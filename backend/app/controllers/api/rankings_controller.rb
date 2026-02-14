# frozen_string_literal: true

module Api
  # ランキングAPIコントローラー
  # GET /api/rankings - TOP20ランキングを取得
  class RankingsController < ApplicationController
    # エラーコード定数
    ERROR_CODE_INTERNAL_ERROR = 'INTERNAL_ERROR'
    ERROR_MESSAGE_INTERNAL_ERROR = 'サーバーエラーが発生しました'

    # GET /api/rankings
    # TOP20のランキングを取得して返す
    def index
      posts = Post.top_rankings(20)
      total_count = Post.total_scored_count
      rankings = posts.each_with_index.map do |post, index|
        post.to_ranking_json(index + 1)
      end
      render json: { rankings: rankings, total_count: total_count }
    rescue StandardError => e
      # 非機能要件: エラー発生時にERRORレベルでログ出力
      Rails.logger.error("[RankingsController#index] Error: error=#{e.class} - #{e.message}")
      render json: { error: ERROR_MESSAGE_INTERNAL_ERROR, code: ERROR_CODE_INTERNAL_ERROR },
             status: :internal_server_error
    end
  end
end
