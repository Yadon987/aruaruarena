# frozen_string_literal: true

# ローカル審査ワーカー未起動時の非同期フォールバックを開始するサービス
class StartLocalJudgmentFallbackService
  THREAD_NAME = 'local-judgment-fallback'

  class << self
    def call(post_id)
      Rails.logger.warn(
        "[JudgmentQueueService] ローカルワーカー未起動のため非同期フォールバックを実行: post_id=#{post_id}"
      )
      Thread.new do
        disable_current_thread_exception_report!
        execute(post_id)
      end
      nil
    end

    private

    def execute(post_id)
      name_current_thread!
      Rails.application.executor.wrap { JudgePostService.call(post_id) }
    rescue StandardError => e
      Rails.logger.error(
        "[JudgmentQueueService] ローカルフォールバック審査に失敗: post_id=#{post_id}, " \
        "error=#{e.class} - #{e.message}\n#{e.backtrace&.join("\n")}"
      )
    end

    def name_current_thread!
      return unless Thread.current.respond_to?(:name=)

      Thread.current.name = THREAD_NAME
    end

    def disable_current_thread_exception_report!
      return unless Thread.current.respond_to?(:report_on_exception=)

      Thread.current.report_on_exception = false
    end
  end
end
