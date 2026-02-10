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

  # Primary Keyは自動的にString型として扱われるため、field定義は不要
  # field :idはDynamoidによって自動的に管理されます

  # Attributes
  field :nickname,      :string
  field :body,          :string
  field :status,        :string, default: 'judging'
  field :average_score, :number
  field :judges_count,  :integer, default: 0
  field :score_key,     :string
  field :created_at,    :string # UnixTimestamp（数値として扱うがString型で保存）

  # Global Secondary Index: RankingIndex
  # status=scored の投稿のみ対象（スパースインデックス）
  global_secondary_index name: :ranking_index,
                         hash_key: :status,
                         range_key: :score_key

  # アソシエーション
  has_many :judgments, dependent: :destroy

  # バリデーション
  validates :id,          presence: { message: 'を入力してください' }
  validates :nickname,    presence: { message: 'を入力してください' },
                          length: { in: 1..20, message: 'は20文字以内で入力してください' }
  validates :body,        presence: { message: 'を入力してください' }
  validates :status,      presence: true,
                          inclusion: { in: %w[judging scored failed] }
  validates :judges_count, presence: { message: 'を入力してください' },
                           numericality: { only_integer: true, greater_than_or_equal_to: 0, less_than_or_equal_to: 3 }
  validates :created_at, presence: { message: 'を入力してください' } # String型でUnixTimestampを保存

  # 本文のgrapheme数をバリデーション
  validate :body_grapheme_length

  # スコア範囲のバリデーション
  validates :average_score, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100 }, allow_nil: true

  # Callbacks
  before_validation :set_created_at, on: :create
  before_validation :sanitize_inputs

  # スコア付き投稿のscore_keyを生成
  # @return [String] score_key（例: "0127#1738041600#uuid"）
  def generate_score_key
    return nil if average_score.blank?

    inv_score = 1000 - (average_score * 10).round # 四捨五入
    format('%<s1>04d#%<s2>010d#%<s3>s', s1: inv_score, s2: created_at, s3: id)
  end

  # ステータスを更新してscore_keyを設定
  # @param new_status [String] 新しいステータス
  def update_status!(new_status)
    self.status = new_status
    # scored以外はscore_keyをクリア（GSIからの除外）
    self.score_key = (generate_score_key if status == 'scored')
    save!
  end

  # ランキング順位を計算
  #
  # @note 効率上の注意: GSIに対してクエリを実行するため、投稿数が増えると遅延が発生する可能性があります
  #       ランキングAPIなど高頻度で呼ばれる場合は、順位情報のキャッシュを検討してください
  #
  # @return [Integer] 順位（1位スタート）
  def calculate_rank
    return nil unless status == 'scored'
    return nil if score_key.blank? # score_keyが設定されていない場合はnilを返す

    # GSIに対してクエリを実行して、自分より上位の投稿数をカウント
    # Dynamoid 3.xではEnumeratorを返すため、to_aで配列に変換
    higher_posts = Post.where(status: 'scored')
                       .where('score_key.lt': score_key)
                       .to_a

    higher_score_count = higher_posts.count

    higher_score_count + 1 # 1位スタート
  end

  private

  # 入力のサニタイズ（前後の空白のみ除去）
  def sanitize_inputs
    self.nickname = nickname&.gsub(/\A[[:space:]]+|[[:space:]]+\z/, '')
    self.body = body&.gsub(/\A[[:space:]]+|[[:space:]]+\z/, '')
  end

  # 本文のgrapheme数バリデーション（3-30文字）
  def body_grapheme_length
    return if body.blank?

    length = body.grapheme_clusters.length
    if length < 3
      errors.add(:body, 'は3〜30文字で入力してください')
    elsif length > 30
      errors.add(:body, 'は3〜30文字で入力してください')
    end
  end

  # 作成日時を設定（UnixTimestampを文字列として保存）
  def set_created_at
    self.created_at ||= Time.now.to_i.to_s
  end
end
