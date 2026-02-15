# frozen_string_literal: true

# DuplicateCheckモデル - 重複チェック
#
# @attr body_hash [String] 本文の正規化後ハッシュ（Partition Key）
# @attr post_id [String] 最初に登録された投稿ID
# @attr expires_at [Integer] 有効期限（UnixTimestamp、TTLにより自動削除）
class DuplicateCheck
  include Dynamoid::Document

  # 定数
  DUPLICATE_DURATION_HOURS = 24
  DUPLICATE_DURATION_SECONDS = DUPLICATE_DURATION_HOURS * 3600 # 86400秒

  # テーブル設定
  table name: 'aruaruarena-duplicate-checks', key: :body_hash

  # Primary Key（自動的にString型として扱われるため、field定義は不要）
  # field :body_hashはDynamoidによって自動的に管理されます

  # Attributes
  field :post_id,    :string # 最初に投稿ID
  field :expires_at, :integer # TTL（24時間後 = 86400秒、UnixTimestampを整数として保存）

  # TTL設定（DynamoDB側で設定されるため、モデル側では特別な設定不要）
  # expires_atフィールドはDynamoDBのTTL機能によって自動削除されます

  # バリデーション
  validates :body_hash,  presence: true
  validates :post_id,    presence: true
  validates :expires_at, presence: true

  # 本文からハッシュを生成（正規化付き）
  # @param body [String] 本文
  # @return [String] ハッシュ
  def self.generate_body_hash(body)
    # 全角→半角、カタカナ→ひらがな、空白統一、小文字化
    normalized = body
                 .unicode_normalize(:nfkc) # 全角→半角（小文字に修正）
                 .tr('ァ-ン', 'ぁ-ん') # カタカナ→ひらがな
                 .gsub(/\s+/, ' ')              # 空白統一
                 .strip.downcase                # 前後空白削除 + 小文字化

    Digest::SHA256.hexdigest(normalized)
  end

  # 重複チェック（本文からハッシュ生成してチェック）
  # @param body [String] 本文（生値）
  # @return [Boolean] 重複ありならtrue、なければfalse
  def self.check(body)
    hash = generate_body_hash(body)
    exists_with_hash?(hash)
  end

  # ハッシュ値での重複チェック（内部用またはハッシュが既にある場合）
  # @param body_hash [String] 本文ハッシュ
  # @return [Boolean] 重複ありならtrue、なければfalse
  def self.exists_with_hash?(body_hash)
    record = find(body_hash)
    record&.expires_at&.to_i&.> Time.now.to_i
  rescue Dynamoid::Errors::RecordNotFound
    false
  rescue StandardError => e
    # フェイルオープン: DB障害時は重複なしと判定
    Rails.logger.error("[DuplicateCheck#exists_with_hash?] DynamoDB error: #{e.class} - #{e.message}")
    false
  end

  # 重複チェックを登録
  # @param body [String] 本文（生値）
  # @param post_id [String] 投稿ID
  # @return [DuplicateCheck] 作成されたチェック
  def self.register(body:, post_id:)
    hash = generate_body_hash(body)
    create!(
      body_hash: hash,
      post_id: post_id,
      expires_at: Time.now.to_i + DUPLICATE_DURATION_SECONDS # 24時間（86400秒）
    )
  end
end
