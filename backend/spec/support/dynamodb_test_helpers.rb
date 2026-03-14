# frozen_string_literal: true

require 'timeout'
require_relative 'dynamodb_constants'

module DynamoDBTestHelpers
  include DynamoDBJudgmentHelpers

  TEST_MODELS = [Post, Judgment, RateLimit, DuplicateCheck].freeze
  CLEANUP_POLL_INTERVAL = 0.1
  CLEANUP_POLL_ATTEMPTS = 10
  POST_CLEANUP_POLL_ATTEMPTS = 30
  CLEANUP_DELETE_TIMEOUT = 10
  POST_CLEANUP_DELETE_TIMEOUT = 20
  CLEANUP_DELETE_RETRY_TIMEOUT = 30

  # DynamoDB Localの整合性問題を回避するため、AWS SDKを直接使用するヘルパー
  # Dynamoidのwhere/findが複合キーで正しく動作しないため

  # テーブル内の全アイテムを削除（テスト前処理用）
  #
  # Timeout.timeoutのスレッド割り込み問題を回避するため、カウントベースのループを使用
  # PostはGSIの反映も待つため、最大3秒（30回 * 0.1秒）待機する
  # それ以外のモデルは最大1秒（10回 * 0.1秒）待機する
  #
  # @raise [RuntimeError] タイムアウトした場合
  # @return [void]
  def cleanup_judgments_table
    cleanup_model_table!(Judgment)
  end

  # テストで利用するDynamoDBが疎通可能かを判定
  #
  # @return [Boolean]
  def dynamodb_available?
    Timeout.timeout(20) { Dynamoid.adapter.list_tables }
    true
  rescue StandardError
    false
  end

  # テストに必要なテーブルを作成し、最新のテーブル一覧を返す
  #
  # @return [Array<String>]
  def ensure_test_tables!
    existing_tables = Timeout.timeout(20) { Dynamoid.adapter.list_tables }

    [Post, Judgment, RateLimit].each do |model|
      next unless defined?(model)
      next if existing_tables.include?(model.table_name)

      model.create_table
      existing_tables << model.table_name
    end

    if defined?(DuplicateCheck) && existing_tables.exclude?(DuplicateCheck.table_name)
      Dynamoid.adapter.create_table(DuplicateCheck.table_name, :body_hash, {})
      existing_tables << DuplicateCheck.table_name
    end

    existing_tables
  end

  # 利用可能なテーブルのみクリーンアップする
  #
  # @param table_names [Array<String>]
  # @return [void]
  def cleanup_test_tables!(table_names)
    TEST_MODELS.each do |model|
      next unless table_names.include?(model.table_name)

      cleanup_model_table!(model)
    rescue Aws::DynamoDB::Errors::ResourceNotFoundException
      # テスト実行中にテーブル状態が変わっても次のモデル削除を継続する
      next
    end
  end

  private

  def cleanup_model_table!(model)
    endpoint = normalized_dynamodb_endpoint
    Dynamoid.config.endpoint = endpoint if endpoint.present? && Dynamoid.config.endpoint != endpoint

    delete_timeout = model == Post ? POST_CLEANUP_DELETE_TIMEOUT : CLEANUP_DELETE_TIMEOUT
    delete_all_with_retry!(model, delete_timeout)
    wait_until_table_empty!(model)
  end

  def delete_all_with_retry!(model, delete_timeout)
    Timeout.timeout(delete_timeout) { model.delete_all }
  rescue Timeout::Error
    # DynamoDB Local が重い瞬間だけ再試行して、恒常的な待機は増やしすぎない
    Timeout.timeout(CLEANUP_DELETE_RETRY_TIMEOUT) { model.delete_all }
  end

  def wait_until_table_empty!(model)
    max_attempts = model == Post ? POST_CLEANUP_POLL_ATTEMPTS : CLEANUP_POLL_ATTEMPTS
    attempt = 0

    while attempt < max_attempts
      return if table_empty?(model)

      sleep(CLEANUP_POLL_INTERVAL)
      attempt += 1
    end

    raise "cleanup_#{model.name.underscore}_table: タイムアウトしました（#{remaining_records_message(model)}）"
  end

  def table_empty?(model)
    Timeout.timeout(3) do
      # rubocop:disable Rails/RedundantActiveRecordAllMethod
      # Dynamoid では model.none? が未定義のため、Criteria を経由して空判定する。
      model.all.none? && post_ranking_index_empty?(model)
      # rubocop:enable Rails/RedundantActiveRecordAllMethod
    end
  end

  def post_ranking_index_empty?(model)
    return true unless model == Post

    Post.where(status: Post::STATUS_SCORED)
        .with_index(:ranking_index)
        .record_limit(1)
        .to_a
        .empty?
  end

  def remaining_records_message(model)
    base_count = Timeout.timeout(3) { model.count }
    return "#{base_count}件のレコードが残存" unless model == Post

    ranking_count = Timeout.timeout(3) do
      Post.where(status: Post::STATUS_SCORED)
          .with_index(:ranking_index)
          .count
    end
    "base=#{base_count}件, ranking_index=#{ranking_count}件が残存"
  end

  def normalized_dynamodb_endpoint
    DynamoDBConstants.normalized_endpoint(ENV.fetch('DYNAMODB_ENDPOINT', nil))
  end
end
