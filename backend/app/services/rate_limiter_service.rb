# frozen_string_literal: true

require 'digest'

# RateLimiterService - レート制限サービス
#
# IPアドレスとニックネームの両方に対して5分間の投稿制限を設ける
class RateLimiterService
  # 定数
  LIMIT_DURATION = 5 # TODO: 開発の利便性のため一時的に5秒に変更（本来は 300）

  LOG_HASH_LENGTH = 16

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

    return false unless ip_limited || nickname_limited

    log_limited_identifiers(ip_identifier, nickname_identifier)
    true
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

    # 片系で失敗しても投稿フローを止めない（フェイルオープン）
    apply_limit_with_fail_open(identifier: ip_identifier, target_label: 'IP')
    apply_limit_with_fail_open(identifier: nickname_identifier, target_label: 'nickname')
  end

  class << self
    private

    def log_limited_identifiers(ip_identifier, nickname_identifier)
      ip_hash = masked_identifier(ip_identifier)
      nickname_hash = masked_identifier(nickname_identifier)
      Rails.logger.error("[RateLimiterService] Limited: ip=#{ip_hash}, nickname=#{nickname_hash}")
    end

    def masked_identifier(identifier)
      return '' unless identifier.is_a?(String)

      Digest::SHA256.hexdigest(identifier).first(LOG_HASH_LENGTH)
    end

    def apply_limit_with_fail_open(identifier:, target_label:)
      RateLimit.set_limit(identifier, seconds: LIMIT_DURATION)
    rescue StandardError => e
      Rails.logger.error("[RateLimiterService] Failed to set #{target_label} limit: #{e.class} - #{e.message}")
    end
  end
end
