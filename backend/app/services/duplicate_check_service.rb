# frozen_string_literal: true

# DuplicateCheckService - 重複チェックサービス
#
# 本文の正規化とSHA256ハッシュ化により、24時間以内の同一内容の投稿を検出する
class DuplicateCheckService
  # 定数
  DUPLICATE_DURATION_HOURS = 24
  DUPLICATE_DURATION_SECONDS = DUPLICATE_DURATION_HOURS * 3600 # 86400秒

  # 同一テキストが24時間以内に投稿されているかチェック
  # @param body [String] 投稿本文（生値。内部で正規化 + ハッシュ化する）
  # @return [Boolean] trueなら重複あり（投稿不可）
  def self.duplicate?(body:)
    hash = DuplicateCheck.generate_body_hash(body)

    if DuplicateCheck.check(hash)
      body_hash_short = hash[0..15]
      Rails.logger.warn("[DuplicateCheckService] Duplicate detected: body_hash=#{body_hash_short}")
      return true
    end

    false
  rescue StandardError => e
    # フェイルオープン: DB障害時は投稿を許可
    Rails.logger.error("[DuplicateCheckService] DynamoDB error: #{e.class} - #{e.message}")
    false
  end

  # 投稿成功後に重複チェックレコードを登録
  # @param body [String] 投稿本文（生値）
  # @param post_id [String] 投稿ID
  # @return [DuplicateCheck, nil] 作成されたレコード（失敗時はnil）
  def self.register!(body:, post_id:)
    hash = DuplicateCheck.generate_body_hash(body)
    DuplicateCheck.register(body_hash: hash, post_id: post_id)
  rescue StandardError => e
    # 登録失敗時はログ出力のみ（投稿自体は成功させる）
    Rails.logger.error("[DuplicateCheckService] register! failed: #{e.class} - #{e.message}")
    nil
  end
end
