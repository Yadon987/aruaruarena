# frozen_string_literal: true

# Secrets ManagerからAI用APIキーを取得するクライアント
#
# 環境変数 SECRETS_MANAGER_ENABLED によって動作を切り替える:
# - "true" の場合: Secrets Manager からAPIキーを取得
# - それ以外の場合: 従来の環境変数から直接取得
#
# キャッシュ機能:
# - 同一ARNへの2回目以降のアクセスはキャッシュから返す
# - clear_cache! でキャッシュをクリアできる
# - テスト環境ではテスト例ごとにキャッシュキーを分離する
#
# エラーハンドリング:
# - ARN不正: ArgumentError ("ARNが不正です")
# - シークレット不存在: ArgumentError ("シークレットが見つかりません")
# - 権限エラー: ArgumentError ("アクセス権限がありません")
# - ネットワークエラー: 3回リトライ後に ArgumentError ("secrets_fetch_failed")
# - JSONパースエラー: ArgumentError ("secrets_parse_error")
class SecretsManagerClient
  AWS_REGION = 'ap-northeast-1'
  # 有効なARNパターン:
  # - サービス: secretsmanager
  # - リージョン: ap-northeast-1
  # - アカウントID: 12桁
  # - シークレット名: aruaruarena/ai-keys/{サービス名}-{ランダム文字列}
  VALID_ARN_PATTERN = %r{
    \Aarn:aws:secretsmanager:ap-northeast-1:\d{12}:secret:
    aruaruarena/ai-keys/[a-z0-9_-]+-[A-Za-z0-9]+\z
  }x
  MAX_RETRIES = 3

  class << self
    def get_api_key(secret_arn:, env_key:)
      return fetch_env_key(env_key) unless secrets_manager_enabled?

      raise ArgumentError, 'ARNが不正です' unless valid_arn?(secret_arn)

      key = cache_key(secret_arn)
      return cache[key] if cache.key?(key)

      api_key = fetch_api_key_with_retry(secret_arn, env_key)
      cache[key] = api_key
      api_key
    end

    def clear_cache!
      @cache = {}
    end

    def valid_arn?(arn)
      arn.is_a?(String) && arn.match?(VALID_ARN_PATTERN)
    end

    private

    def cache
      @cache ||= {}
    end

    def cache_key(secret_arn)
      return secret_arn unless defined?(RSpec) && RSpec.respond_to?(:current_example)

      [secret_arn, RSpec.current_example&.id]
    end

    def secrets_manager_enabled?
      ENV.fetch('SECRETS_MANAGER_ENABLED', 'false') == 'true'
    end

    def fetch_env_key(env_key)
      key = ENV.fetch(env_key, nil)
      raise ArgumentError, "#{env_key}が設定されていません" if key.nil? || key.strip.empty?

      key
    end

    def fetch_api_key_with_retry(secret_arn, env_key)
      retries = 0

      begin
        fetch_api_key(secret_arn, env_key)
      rescue ArgumentError => e
        raise e unless e.message == 'secrets_fetch_failed'

        retries += 1
        retry if retries <= MAX_RETRIES

        raise
      end
    end

    def fetch_api_key(secret_arn, env_key)
      response = client.get_secret_value(secret_id: secret_arn)
      parse_secret_string(response.secret_string, env_key)
    rescue Aws::SecretsManager::Errors::ResourceNotFoundException
      raise ArgumentError, 'シークレットが見つかりません'
    rescue Aws::SecretsManager::Errors::AccessDeniedException
      raise ArgumentError, 'アクセス権限がありません'
    rescue Aws::SecretsManager::Errors::ServiceError
      raise ArgumentError, 'secrets_fetch_failed'
    rescue JSON::ParserError
      raise ArgumentError, 'secrets_parse_error'
    end

    def parse_secret_string(secret_string, env_key)
      secret_body = JSON.parse(secret_string)
      api_key = secret_body['api_key']

      raise ArgumentError, "#{env_key}が設定されていません" if api_key.nil? || api_key.to_s.strip.empty?

      api_key
    rescue KeyError
      raise ArgumentError, 'secrets_parse_error'
    end

    def client
      @client ||= Aws::SecretsManager::Client.new(region: AWS_REGION)
    end
  end
end
