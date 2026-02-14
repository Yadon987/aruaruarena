# frozen_string_literal: true

# RateLimiterService - レート制限サービス
#
# IPアドレスとニックネームの両方に対して5分間の投稿制限を設ける
class RateLimiterService
  LIMIT_DURATION = 300

  # IPアドレスまたはニックネームが制限中かチェック
  # @param ip [String] IPアドレス（生値。内部でハッシュ化する）
  # @param nickname [String] ニックネーム（生値。内部でハッシュ化する）
  # @return [Boolean] trueなら制限中（投稿不可）
  def self.limited?(ip:, nickname:)
    ip_identifier = RateLimit.generate_ip_identifier(ip)
    nickname_identifier = RateLimit.generate_nickname_identifier(nickname)

    # IPとニックネームの両方をチェック（OR条件）
    ip_limited = RateLimit.limited?(ip_identifier)
    nickname_limited = RateLimit.limited?(nickname_identifier)

    if ip_limited || nickname_limited
      ip_hash = RateLimit.generate_ip_identifier(ip)[3..18]
      nickname_hash = RateLimit.generate_nickname_identifier(nickname)[5..20]
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

    RateLimit.set_limit(ip_identifier, seconds: LIMIT_DURATION)
    RateLimit.set_limit(nickname_identifier, seconds: LIMIT_DURATION)
  end
end
