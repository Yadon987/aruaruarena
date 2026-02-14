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
        key: :post_id

  # Range Key（Dynamoidのrangeメソッドを使用）
  range :persona, :string

  # Attributes
  field :id,            :string # UUID
  field :succeeded,     :boolean, default: false
  field :error_code,    :string

  # Scores（失敗時はNULL）
  field :empathy,       :integer
  field :humor,         :integer
  field :brevity,       :integer
  field :originality,   :integer
  field :expression,    :integer
  field :total_score,   :integer
  field :comment,       :string

  # Timestamp（UnixTimestampを文字列として保存）
  field :judged_at,     :string

  # アソシエーション
  belongs_to :post

  # バリデーション
  validates :persona,   presence: true, inclusion: { in: %w[hiroyuki dewi nakao] }
  validates :id,        presence: true
  validates :succeeded, inclusion: { in: [true, false] }
  validates :judged_at, presence: true # String型でUnixTimestampを保存

  # スコア範囲のバリデーション（成功時のみ必須）
  with_options if: :succeeded? do
    validates :empathy,     presence: true,
                            numericality: { only_integer: true, greater_than_or_equal_to: 0, less_than_or_equal_to: 20 }
    validates :humor,       presence: true,
                            numericality: { only_integer: true, greater_than_or_equal_to: 0, less_than_or_equal_to: 20 }
    validates :brevity,     presence: true,
                            numericality: { only_integer: true, greater_than_or_equal_to: 0, less_than_or_equal_to: 20 }
    validates :originality, presence: true,
                            numericality: { only_integer: true, greater_than_or_equal_to: 0, less_than_or_equal_to: 20 }
    validates :expression,  presence: true,
                            numericality: { only_integer: true, greater_than_or_equal_to: 0, less_than_or_equal_to: 20 }
    validates :total_score, presence: true,
                            numericality: { only_integer: true, greater_than_or_equal_to: 0, less_than_or_equal_to: 100 }
    validates :comment,     presence: true
  end

  # エラーコードのバリデーション（失敗時のみ必須）
  validates :error_code, presence: true, unless: :succeeded?

  # Callbacks
  before_create :set_judged_at

  # 審査員のバイアスを適用したスコアを計算
  # @param base_scores [Hash] 基本スコア（empathy, humor, brevity, originality, expression）
  # @return [Hash] バイアス適用後のスコア
  def self.apply_persona_bias(base_scores, persona)
    scores = base_scores.dup
    apply_bias_by_persona(scores, persona)
    scores
  end

  # ペルソナごとのバイアス適用
  # @param scores [Hash] スコア（破壊的変更）
  # @param persona [String] ペルソナID
  def self.apply_bias_by_persona(scores, persona)
    case persona
    when 'hiroyuki' then apply_hiroyuki_bias(scores)
    when 'dewi'     then apply_dewi_bias(scores)
    when 'nakao'    then apply_nakao_bias(scores)
    end
  end

  # ひろゆき風: 独創性(+3)、共感度(-2)
  def self.apply_hiroyuki_bias(scores)
    scores[:originality] = [scores[:originality] + 3, 20].min
    scores[:empathy]     = [scores[:empathy] - 2, 0].max
  end

  # デヴィ婦人風: 表現力(+3)、面白さ(+2)
  def self.apply_dewi_bias(scores)
    scores[:expression] = [scores[:expression] + 3, 20].min
    scores[:humor]      = [scores[:humor] + 2, 20].min
  end

  # 中尾彬風: 面白さ(+3)、共感度(+2)
  def self.apply_nakao_bias(scores)
    scores[:humor]   = [scores[:humor] + 3, 20].min
    scores[:empathy] = [scores[:empathy] + 2, 20].min
  end

  # 合計点を計算
  # @param scores [Hash] 5項目のスコア
  # @return [Integer] 合計点（0-100）
  def self.calculate_total_score(scores)
    scores.values.sum
  end

  private

  # 審査日時を設定（UnixTimestampを文字列として保存）
  def set_judged_at
    self.judged_at ||= Time.now.to_i.to_s
  end
end
