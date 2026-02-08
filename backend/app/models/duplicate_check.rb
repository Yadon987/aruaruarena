# frozen_string_literal: true

# DuplicateCheckモデル - 重複チェック
#
# @attr body_hash [String] 本文の正規化後ハッシュ（Partition Key）
# @attr post_id [String] 最初に登録された投稿ID
# @attr expires_at [Integer] 有効期限（UnixTimestamp、TTLにより自動削除）
class DuplicateCheck
  include Dynamoid::Document

  # テーブル設定
  table name: 'aruaruarena-duplicate-checks', key: :body_hash

  # Primary Key
  field :body_hash,  String # 正規化後ハッシュ

  # Attributes
  field :post_id,    String # 最初に投稿ID
  field :expires_at, Integer # TTL（24時間後 = 86400秒）

  # TTLをDynamoDBに伝えるための設定
  self.ttl_attribute = :expires_at

  # バリデーション
  validates :body_hash,  presence: true
  validates :post_id,    presence: true
  validates :expires_at, presence: true, numericality: { only_integer: true }

  # 本文からハッシュを生成（正規化付き）
  # @param body [String] 本文
  # @return [String] ハッシュ
  def self.generate_body_hash(body)
    # 全角→半角、カタカナ→ひらがな、空白統一、小文字化
    normalized = body
      .unicode_normalize(:NFKC)      # 全角→半角
      .tr('ァ-ン', 'ぁ-ん')           # カタカナ→ひらがな
      .gsub(/\s+/, ' ')              # 空白統一
      .strip.downcase                # 前後空白削除 + 小文字化

    Digest::SHA256.hexdigest(normalized)
  end

  # 重複チェック
  # @param body [String] 本文
  # @return [DuplicateCheck, nil] 既存のチェック、なければnil
  def self.check(body)
    hash = generate_body_hash(body)
    find_by(body_hash: hash)
  end

  # 重複チェックを登録
  # @param body [String] 本文
  # @param post_id [String] 投稿ID
  # @param hours [Integer] 保持時間（デフォルト: 24時間）
  # @return [DuplicateCheck] 作成されたチェック
  def self.register(body, post_id, hours: 24)
    hash = generate_body_hash(body)
    create!(
      body_hash: hash,
      post_id: post_id,
      expires_at: Time.now.to_i + (hours * 3600)
    )
  end
end
