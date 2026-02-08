# frozen_string_literal: true

# Judgmentモデル - 審査結果
#
# @attr post_id [String] 投稿ID（Partition Key）
# @attr persona [String] 審査員ID（hiroyuki/dewi/nakao）（Sort Key）
# @attr id [String] UUID（ログ・デバッグ用）
# @attr succeeded [Boolean] API成功/失敗
# @attr error_code [String] 失敗時のエラーコード
# @attr empathy [Integer] 共感度（0-20）
# @attr humor [Integer] 面白さ（0-20）
# @attr brevity [Integer] 簡潔さ（0-20）
# @attr originality [Integer] 独創性（0-20）
# @attr expression [Integer] 表現力（0-20）
# @attr total_score [Integer] 合計点（0-100）
# @attr comment [String] 審査コメント
# @attr judged_at [Integer] 最終審査日時（UnixTimestamp）
class Judgment
  include Dynamoid::Document

  # テーブル設定
  table name: 'aruaruarena-judgments',
         key: { hash: :post_id, range: :persona }

  # Primary Key
  field :post_id, String # Partition Key
  field :persona, String # Sort Key

  # Attributes
  field :id,            String # UUID
  field :succeeded,     Boolean, default: false
  field :error_code,    String

  # Scores（失敗時はNULL）
  field :empathy,       Integer
  field :humor,         Integer
  field :brevity,       Integer
  field :originality,   Integer
  field :expression,    Integer
  field :total_score,   Integer
  field :comment,       String

  # Timestamp
  field :judged_at,     Integer

  # アソシエーション
  belongs_to :post

  # バリデーション
  validates :post_id,   presence: true
  validates :persona,   presence: true, inclusion: { in: %w[hiroyuki dewi nakao] }
  validates :id,        presence: true
  validates :succeeded, inclusion: { in: [true, false] }
  validates :judged_at, presence: true, numericality: { only_integer: true }

  # スコア範囲のバリデーション（成功時のみ必須）
  with_options if: :succeeded? do
    validates :empathy,     presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0, less_than_or_equal_to: 20 }
    validates :humor,       presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0, less_than_or_equal_to: 20 }
    validates :brevity,     presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0, less_than_or_equal_to: 20 }
    validates :originality, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0, less_than_or_equal_to: 20 }
    validates :expression,  presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0, less_than_or_equal_to: 20 }
    validates :total_score, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0, less_than_or_equal_to: 100 }
    validates :comment,     presence: true
  end

  # エラーコードのバリデーション（失敗時のみ必須）
  validates :error_code, presence: true, on: :failure

  # Callbacks
  before_create :set_judged_at

  # 審査員のバイアスを適用したスコアを計算
  # @param base_scores [Hash] 基本スコア（empathy, humor, brevity, originality, expression）
  # @return [Hash] バイアス適用後のスコア
  def self.apply_persona_bias(base_scores, persona)
    scores = base_scores.dup

    case persona
    when 'hiroyuki'
      # ひろゆき風: 独創性(+3)、共感度(-2)
      scores[:originality] = [scores[:originality] + 3, 20].min
      scores[:empathy] = [scores[:empathy] - 2, 0].max
    when 'dewi'
      # デヴィ婦人風: 表現力(+3)、面白さ(+2)
      scores[:expression] = [scores[:expression] + 3, 20].min
      scores[:humor] = [scores[:humor] + 2, 20].min
    when 'nakao'
      # 中尾彬風: 面白さ(+3)、共感度(+2)
      scores[:humor] = [scores[:humor] + 3, 20].min
      scores[:empathy] = [scores[:empathy] + 2, 20].min
    end

    scores
  end

  # 合計点を計算
  # @param scores [Hash] 5項目のスコア
  # @return [Integer] 合計点（0-100）
  def self.calculate_total_score(scores)
    scores.values.sum
  end

  private

  # 審査日時を設定
  def set_judged_at
    self.judged_at ||= Time.now.to_i
  end
end
