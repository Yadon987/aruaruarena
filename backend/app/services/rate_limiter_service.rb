# frozen_string_literal: true

# RateLimiterService - レート制限サービス
#
# IPアドレスとニックネームの両方に対して5分間の投稿制限を設ける
class RateLimiterService
  # 定数
  LIMIT_DURATION = 300

  # ログ出力用のハッシュインデックス
  HASH_LOG_START_INDEX = 3  # ハッシュの開始位置（ログ出力用）
  HASH_LOG_END_INDEX = 19   # ハッシュの終了位置（ログ出力用）

  # IPアドレスまたはニックネームが制限中かチェック
  # @param ip [String] IPアドレス（生値。内部でハッシュ化する）
  # @param nickname [String] ニックネーム（生値。内部でハッシュ化する）
  # @return [Boolean] trueなら制限中（投稿不可）
  def self.limited?(ip:, nickname:)
    ip_identifier = RateLimit.generate_ip_identifier(ip)
    nickname_identifier = RateLimit.generate_nickname_identifier(nickname)

    # IPとニックネームの両方をチェック（OR条件）
    # いずれか一方が制限中であれば投稿を拒否する
    ip_limited = RateLimit.limited?(ip_identifier)
    nickname_limited = RateLimit.limited?(nickname_identifier)

    if ip_limited || nickname_limited
      ip_hash = ip_identifier[HASH_LOG_START_INDEX..HASH_LOG_END_INDEX]
      nickname_hash = nickname_identifier[HASH_LOG_START_INDEX..HASH_LOG_END_INDEX]
      Rails.logger.error("[RateLimiterService] Limited: ip=#{ip_hash}, nickname=#{nickname_hash}")
      return true
    end

    false
  rescue StandardError => e
    # フェイルオープン: エラー時は投稿を許可
    Rails.logger.error("[RateLimiterService] DynamoDB error: #{e.class} - #{e.message}")
    false
  end

  # 投稿成功後にIPアドレスとニックネームの両方に制限を設定
  # @param ip [String] IPアドレス（生値）
  # @param nickname [String] ニックネーム（生値）
  # @return [void]
  def self.set_limit!(ip:, nickname:)
    ip_identifier = RateLimit.generate_ip_identifier(ip)
    nickname_identifier = RateLimit.generate_nickname_identifier(nickname)

    # IP制限設定（フェイルオープン）
    begin
      RateLimit.set_limit(ip_identifier, seconds: LIMIT_DURATION)
    rescue StandardError => e
      Rails.logger.error("[RateLimiterService] Failed to set IP limit: #{e.class} - #{e.message}")
    end

    # ニックネーム制限設定（フェイルオープン）
    begin
      RateLimit.set_limit(nickname_identifier, seconds: LIMIT_DURATION)
    rescue StandardError => e
      Rails.logger.error("[RateLimiterService] Failed to set nickname limit: #{e.class} - #{e.message}")
    end
  end
end
