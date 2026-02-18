# frozen_string_literal: true

require 'timeout'

module DynamoDBTestHelpers
  TEST_MODELS = [Post, Judgment, RateLimit, DuplicateCheck].freeze

  # DynamoDB Localの整合性問題を回避するため、AWS SDKを直接使用するヘルパー
  # Dynamoidのwhere/findが複合キーで正しく動作しないため

  # DynamoDB項目からJudgmentオブジェクトを構築する共通メソッド
  #
  # @param item [Hash] DynamoDBから取得した項目
  # @return [Judgment] 構築されたJudgmentオブジェクト
  def build_judgment_from_item(item)
    Judgment.new(
      post_id: item['post_id'],
      persona: item['persona'],
      id: item['id'],
      succeeded: item['succeeded'],
      error_code: item['error_code'],
      judged_at: item['judged_at'],
      empathy: item['empathy'],
      humor: item['humor'],
      brevity: item['brevity'],
      originality: item['originality'],
      expression: item['expression'],
      total_score: item['total_score'],
      comment: item['comment']
    )
  end

  def find_judgment_by_aws(post_id, persona)
    client = Dynamoid.adapter.client
    response = client.get_item(
      table_name: Judgment.table_name,
      key: {
        post_id: post_id,
        persona: persona
      }
    )
    return nil if response.item.nil?

    build_judgment_from_item(response.item)
  end

  def query_judgments_by_post_id(post_id)
    client = Dynamoid.adapter.client
    response = client.query(
      table_name: Judgment.table_name,
      key_condition_expression: 'post_id = :post_id',
      expression_attribute_values: {
        ':post_id' => post_id
      }
    )

    response.items.map { |item| build_judgment_from_item(item) }
  end

  # テーブル内の全アイテムを削除（テスト前処理用）
  #
  # Timeout.timeoutのスレッド割り込み問題を回避するため、カウントベースのループを使用
  # 最大10秒（100回 * 0.1秒）待機し、タイムアウトした場合はエラーを発生させる
  #
  # @raise [RuntimeError] タイムアウトした場合
  # @return [void]
  def cleanup_judgments_table
    endpoint = ENV.fetch('DYNAMODB_ENDPOINT', nil)
    Dynamoid.config.endpoint = endpoint if endpoint.present? && Dynamoid.config.endpoint != endpoint

    Timeout.timeout(5) { Judgment.delete_all }
    # 削除が完了するまで待機（ポーリング）
    max_attempts = 100
    attempt = 0
    until Timeout.timeout(3) { Judgment.count }.zero? || attempt >= max_attempts
      sleep(0.1)
      attempt += 1
    end

    # タイムアウト時にエラーを明示的に発生させる
    return if Timeout.timeout(3) { Judgment.count }.zero?

    remaining = Timeout.timeout(3) { Judgment.count }
    raise "cleanup_judgments_table: タイムアウトしました（#{max_attempts}回試行後も#{remaining}件のレコードが残存）"
  end

  # テストで利用するDynamoDBが疎通可能かを判定
  #
  # @return [Boolean]
  def dynamodb_available?
    Timeout.timeout(20) { Dynamoid.adapter.list_tables }
    true
  rescue Timeout::Error, StandardError
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

      model.delete_all
    rescue Aws::DynamoDB::Errors::ResourceNotFoundException
      # テスト実行中にテーブル状態が変わっても次のモデル削除を継続する
      next
    end
  end
end
