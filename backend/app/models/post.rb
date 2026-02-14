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

  # バリデーション定数
  NICKNAME_MIN_LENGTH = 1
  NICKNAME_MAX_LENGTH = 20
  BODY_MIN_LENGTH = 3
  BODY_MAX_LENGTH = 30
  JUDGES_COUNT_MIN = 0
  JUDGES_COUNT_MAX = 3
  AVERAGE_SCORE_MIN = 0
  AVERAGE_SCORE_MAX = 100

  # ステータス定数
  STATUS_JUDGING = 'judging'
  STATUS_SCORED = 'scored'
  STATUS_FAILED = 'failed'
  STATUSES = [STATUS_JUDGING, STATUS_SCORED, STATUS_FAILED].freeze

  # スコア計算定数
  SCORE_MULTIPLIER = 10
  SCORE_BASE = 1000

  # ランキング取得件数のデフォルト値
  DEFAULT_RANKING_LIMIT = 20

  # テーブル設定
  table name: 'aruaruarena-posts', key: :id
  # 読み書きのキャパシティ（オンデマンドモードでは無効）
  # capacity_mode: :on_demand

  # Primary Keyは自動的にString型として扱われるため、field定義は不要
  # field :idはDynamoidによって自動的に管理されます

  # Attributes
  field :nickname,      :string
  field :body,          :string
  field :status,        :string, default: STATUS_JUDGING
  field :average_score, :number
  field :judges_count,  :integer, default: JUDGES_COUNT_MIN
  field :score_key,     :string
  field :created_at,    :string # UnixTimestamp（数値として扱うがString型で保存）

  # Global Secondary Index: RankingIndex
  # status=scored の投稿のみ対象（スパースインデックス）
  global_secondary_index name: :ranking_index,
                         hash_key: :status,
                         range_key: :score_key

  # アソシエーション
  has_many :judgments

  # バリデーション
  validates :id,          presence: { message: 'を入力してください' }
  validates :nickname,    presence: { message: 'を入力してください' },
                          length: { in: NICKNAME_MIN_LENGTH..NICKNAME_MAX_LENGTH, message: 'は20文字以内で入力してください' }
  validates :body,        presence: { message: 'を入力してください' }
  validates :status,      presence: true,
                          inclusion: { in: STATUSES }
  validates :judges_count, presence: { message: 'を入力してください' },
                           numericality: {
                             only_integer: true,
                             greater_than_or_equal_to: JUDGES_COUNT_MIN,
                             less_than_or_equal_to: JUDGES_COUNT_MAX
                           }
  validates :created_at, presence: { message: 'を入力してください' } # String型でUnixTimestampを保存

  # 本文のgrapheme数をバリデーション
  validate :body_grapheme_length

  # スコア範囲のバリデーション
  validates :average_score,
            numericality: {
              greater_than_or_equal_to: AVERAGE_SCORE_MIN,
              less_than_or_equal_to: AVERAGE_SCORE_MAX
            },
            allow_nil: true

  # Callbacks
  before_validation :set_created_at, on: :create
  before_validation :sanitize_inputs
  before_destroy :check_judgments_presence

  # スコア付き投稿のscore_keyを生成
  # @return [String] score_key（例: "0127#1738041600#uuid"）
  def generate_score_key
    return nil if average_score.blank?

    inv_score = SCORE_BASE - (average_score * SCORE_MULTIPLIER).round # 四捨五入
    format('%<s1>04d#%<s2>010d#%<s3>s', s1: inv_score, s2: created_at, s3: id)
  end

  # ステータスを更新してscore_keyを設定
  # @param new_status [String] 新しいステータス
  def update_status!(new_status)
    self.status = new_status
    # scored以外はscore_keyをクリア（GSIからの除外）
    self.score_key = (generate_score_key if status == STATUS_SCORED)
    save!
  end

  # ランキング順位を計算する
  #
  # GSI(RankingIndex)に対してクエリを実行し、自分より上位のscore_keyを持つ投稿数をカウント
  # score_key = "inv_score#created_at#id" のため、辞書順で小さい方がスコアが高い
  #
  # @note 効率上の注意: GSIに対してクエリを実行するため、投稿数が増えると遅延が発生する可能性があります
  #       ランキングAPIなど高頻度で呼ばれる場合は、順位情報のキャッシュを検討してください
  #
  # @return [Integer, nil] 順位（1位スタート）。scored以外のステータスはnilを返す
  def calculate_rank
    return nil unless status == STATUS_SCORED
    return nil if score_key.blank?

    # GSIクエリで自分より上位（score_keyが小さい）の投稿数を取得
    # with_indexでranking_indexを明示的に指定してQuery操作を使用
    higher_count = Post.where(status: STATUS_SCORED)
                       .where('score_key.lt': score_key)
                       .with_index(:ranking_index)
                       .count

    higher_count + 1
  end

  # 投稿詳細のAPI レスポンス用JSON形式で返す
  #
  # 以下のフィールドを含む:
  # - id, nickname, body: 投稿の基本情報
  # - average_score: 成功した審査員のtotal_scoreの平均値（DynamoDBから取得した値をFloat変換）
  # - status: 審査状態（judging/scored/failed）
  # - judges_count: 成功した審査員数（0-3）
  # - rank: ランキング順位（scored以外はnil）
  # - total_count: 全scored投稿数
  # - judgments: 審査結果の配列（Judgment#to_judgment_jsonで変換）
  #
  # @param judgments [Array<Judgment>] 審査結果の配列
  # @param rank [Integer, nil] ランキング順位
  # @param total_count [Integer] 全scored投稿数
  # @return [Hash] JSON形式の投稿詳細
  def to_detail_json(judgments, rank, total_count)
    {
      id: id,
      nickname: nickname,
      body: body,
      average_score: average_score&.to_f,
      status: status,
      judges_count: judges_count,
      rank: rank,
      total_count: total_count,
      judgments: judgments.map(&:to_judgment_json)
    }
  end

  # ランキングAPI用のJSON形式を返す
  #
  # @param rank [Integer] 順位
  # @return [Hash] ランキングJSON形式
  def to_ranking_json(rank)
    {
      rank: rank,
      id: id,
      nickname: nickname,
      body: body,
      average_score: average_score&.to_f
    }
  end

  # TOPランキングを取得する
  #
  # GSI(RankingIndex)のstatus='scored'でクエリし、score_key昇順で取得
  # score_key昇順 = スコア降順（inv_scoreが小さいほど高スコア）
  #
  # DynamoDBのGSIは投影属性が限られているため、GSIクエリでIDを取得した後、
  # テーブルから完全なレコードを取得する2段階のクエリを実行している
  #
  # @param limit [Integer] 取得件数（デフォルト: DEFAULT_RANKING_LIMIT）
  # @return [Array<Post>] ランキング順のPost配列
  def self.top_rankings(limit = DEFAULT_RANKING_LIMIT)
    # GSIからscore_key昇順でIDを取得
    gsi_results = where(status: STATUS_SCORED)
                  .with_index(:ranking_index)
                  .scan_index_forward(true)
                  .record_limit(limit)
                  .to_a

    # IDのリストを取得（GSIクエリ結果の順序を維持）
    ids = gsi_results.map(&:id)

    # テーブルから完全なレコードを取得
    return [] if ids.empty?

    # IDの順序を維持して返す
    posts = find(ids).index_by(&:id)
    ids.filter_map { |id| posts[id] }
  end

  # 全scored投稿数を取得する
  #
  # GSI(RankingIndex)のstatus='scored'でクエリし、該当する投稿数をカウント
  #
  # @note パフォーマンス注意: DynamoDBではScanベースのcountになる可能性あり。
  #       投稿数が増大した場合はキャッシュの導入を検討すること。
  #
  # @return [Integer] scored状態の投稿数
  def self.total_scored_count
    where(status: STATUS_SCORED)
      .with_index(:ranking_index)
      .count
  end

  private

  # 入力のサニタイズ（前後の空白のみ除去）
  #
  # POSIX文字クラス [[:space:]] は、半角空白（U+0020）と全角空白（U+3000）の両方にマッチ
  # \A[[:space:]]+ で先頭の空白、[[:space:]]+\z で末尾の空白を除去
  # 内部の空白は保持する（連続する空白やタブ・改行はそのまま）
  #
  # @example 前後の半角空白を除去
  #   sanitize_inputs #=> "太郎" (元: " 太郎 ")
  # @example 前後の全角空白を除去
  #   sanitize_inputs #=> "太郎" (元: "　太郎　")
  # @example 内部の空白は保持
  #   sanitize_inputs #=> "太　郎" (元: "太　郎")
  def sanitize_inputs
    self.nickname = nickname&.gsub(/\A[[:space:]]+|[[:space:]]+\z/, '')
    self.body = body&.gsub(/\A[[:space:]]+|[[:space:]]+\z/, '')
  end

  # 本文のgrapheme数バリデーション（3-30文字）
  #
  # grapheme単位でカウントすることで、絵文字・結合文字・修飾子を正しく1文字としてカウント
  #
  # - 絵文字（😀😀😀）: 3 grapheme
  # - 結合絵文字（👨‍👩‍👧‍👦）: 1 grapheme（7 codepointsだが1書記素）
  # - 絵文字修飾子（👨🏻‍💻）: 1 grapheme（5 codepointsだが1書記素）
  #
  # @see docs/db_schema.md バリデーション仕様
  def body_grapheme_length
    return if body.blank?

    # String#grapheme_clusters でUnicodeのgrapheme clusters（書記素クラスタ）を取得
    length = body.grapheme_clusters.length
    return unless length < BODY_MIN_LENGTH || length > BODY_MAX_LENGTH

    errors.add(:body, 'は3〜30文字で入力してください')
  end

  # 作成日時を設定（UnixTimestampを文字列として保存）
  #
  # 作成時にcreated_atが未設定の場合、現在時刻をUnixTimestampとして設定
  # DynamoDBには日時型がないため、文字列型で保存
  #
  # @return [void]
  def set_created_at
    self.created_at ||= current_timestamp
  end

  # 現在のUnixタイムスタンプを文字列として返す
  # @return [String] UnixTimestamp（例: "1738041600"）
  def current_timestamp
    Time.now.to_i.to_s
  end

  # Judgmentが存在する場合は削除を防止
  #
  # Dynamoidではdependent: :restrict_with_errorがサポートされていないため、
  # before_destroyコールバックで手動実装
  #
  # @return [Boolean] 削除許可ならtrue、禁止ならabort
  def check_judgments_presence
    return true if judgments.empty?

    errors.add(:base, '審査結果が存在する投稿は削除できません')
    throw(:abort)
  end
end
