# frozen_string_literal: true

# RateLimitモデル - レート制限
#
# @attr identifier [String] 識別子（ip#hash または nick#hash）（Partition Key）
# @attr expires_at [Integer] 有効期限（UnixTimestamp、TTLにより自動削除）
class RateLimit
  include Dynamoid::Document

  # テーブル設定
  table name: 'aruaruarena-rate-limits', key: :identifier

  # Primary Key
  field :identifier, String # ip#hash または nick#hash

  # TTL設定（5分後 = 300秒）
  field :expires_at, Integer

  # TTLをDynamoDBに伝えるための設定
  # Dynamoidではttl_attributeを指定
  self.ttl_attribute = :expires_at

  # バリデーション
  validates :identifier, presence: true
  validates :expires_at, presence: true, numericality: { only_integer: true }

  # IPアドレスから識別子を生成
  # @param ip [String] IPアドレス
  # @return [String] 識別子（ip#hash）
  def self.generate_ip_identifier(ip)
    "ip##{Digest::SHA256.hexdigest(ip)[0..15]}"
  end

  # ニックネームから識別子を生成
  # @param nickname [String] ニックネーム
  # @return [String] 識別子（nick#hash）
  def self.generate_nickname_identifier(nickname)
    "nick##{Digest::SHA256.hexdigest(nickname)[0..15]}"
  end

  # レート制限をチェック
  # @param identifier [String] 識別子
  # @return [Boolean] trueなら制限中（投稿不可）
  def self.limited?(identifier)
    find_by(identifier: identifier).present?
  end

  # レート制限を設定
  # @param identifier [String] 識別子
  # @param seconds [Integer] 制限時間（デフォルト: 300秒 = 5分）
  # @return [RateLimit] 作成されたレート制限
  def self.set_limit(identifier, seconds: 300)
    create!(
      identifier: identifier,
      expires_at: Time.now.to_i + seconds
    )
  end
end
