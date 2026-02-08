# frozen_string_literal: true

# Postモデル - 投稿データ
#
# @attr id [String] UUID（Partition Key）
# @attr nickname [String] ニックネーム（1-20文字）
# @attr body [String] 本文（3-30文字、grapheme単位）
# @attr status [String] ステータス（judging/scored/failed）
# @attr average_score [Float] 平均点（小数第1位）
# @attr judges_count [Integer] 成功した審査員数（0-3）
# @attr score_key [String] GSI Sort Key（status=scoredのみ設定）
# @attr created_at [Integer] 作成日時（UnixTimestamp）
class Post
  include Dynamoid::Document

  # テーブル設定
  table name: 'aruaruarena-posts', key: :id
  # 読み書きのキャパシティ（オンデマンドモードでは無効）
  # capacity_mode: :on_demand

  # Primary Key
  field :id,            String # UUID
  #timestampsは使用しない（DynamoDBの型が合わないため）

  # Attributes
  field :nickname,      String
  field :body,          String
  field :status,        String, default: 'judging'
  field :average_score, Float
  field :judges_count,  Integer, default: 0
  field :score_key,     String
  field :created_at,    Integer

  # Global Secondary Index: RankingIndex
  # status=scored の投稿のみ対象（スパースインデックス）
  global_secondary_index name: :ranking_index,
                         hash_key: :status,
                         range_key: :score_key

  # アソシエーション
  has_many :judgments, foreign_key: :post_id

  # バリデーション
  validates :id,          presence: true
  validates :nickname,    presence: true, length: { in: 1..20 }
  validates :body,        presence: true
  validates :status,      presence: true, inclusion: { in: %w[judging scored failed] }
  validates :judges_count, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0, less_than_or_equal_to: 3 }
  validates :created_at,  presence: true, numericality: { only_integer: true }

  # 本文のgrapheme数をバリデーション
  validate :body_grapheme_length

  # スコア範囲のバリデーション
  validates :average_score, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100 }, allow_nil: true

  # Callbacks
  before_create :set_created_at

  # スコア付き投稿のscore_keyを生成
  # @return [String] score_key（例: "0127#1738041600#uuid"）
  def generate_score_key
    return nil if average_score.blank?
    inv_score = 1000 - (average_score * 10).round  # 四捨五入
    format('%04d#%010d#%s', inv_score, created_at, id)
  end

  # ステータスを更新してscore_keyを設定
  # @param new_status [String] 新しいステータス
  def update_status!(new_status)
    self.status = new_status
    if status == 'scored'
      self.score_key = generate_score_key
    else
      # scored以外はscore_keyをクリア（GSIからの除外）
      self.score_key = nil
    end
    save!
  end

  # ランキング順位を計算
  # @return [Integer] 順位（1位スタート）
  def calculate_rank(total_count: nil)
    return nil unless status == 'scored'

    # 自分より上位の投稿数をカウント（LT = より小さい）
    higher_score_count = Post.where('status EQ ?', 'scored')
                              .where('score_key LT ?', score_key)
                              .count

    higher_score_count + 1  # 1位スタート
  end

  private

  # 本文のgrapheme数バリデーション（3-30文字）
  def body_grapheme_length
    return if body.blank?

    length = body.grapheme_clusters.length
    if length < 3 || length > 30
      errors.add(:body, "は3〜30文字である必要があります（現在: #{length}文字）")
    end
  end

  # 作成日時を設定
  def set_created_at
    self.created_at ||= Time.now.to_i
  end
end
