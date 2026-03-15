# frozen_string_literal: true

require 'rails_helper'
require 'timeout'

# Issue: E06-05
RSpec.describe JudgePostService do
  # AdapterTestHelpersのメソッドを使用
  include AdapterTestHelpers

  # DynamoDBテストヘルパーをinclude
  include DynamoDBTestHelpers

  # 何を検証するか: 定数の定義
  describe '定数' do
    it 'JUDGES定数が定義されていること' do
      expect(described_class::JUDGES).to be_a(Array)
      expect(described_class::JUDGES.size).to eq(3)
    end

    it 'JUDGESに3人の審査員が含まれること' do
      judges = described_class::JUDGES
      personas = judges.pluck(:persona)
      expect(personas).to contain_exactly('hiroyuki', 'dewi', 'nakao')
    end

    it 'JOIN_TIMEOUT定数が定義されていること' do
      expect(described_class::JOIN_TIMEOUT).to eq(90)
    end

    it 'Executor関連の定数が定義されていること' do
      expect(described_class::EXECUTOR_THREAD_COUNT).to eq(described_class::JUDGES.size)
      expect(described_class::EXECUTOR_MAX_QUEUE).to eq(described_class::JUDGES.size)
      expect(described_class::EXECUTOR_SHUTDOWN_WAIT_SECONDS).to eq(5)
    end
  end
  describe '.call' do
    # 何を検証するか: Postが見つからない場合はWARNログを出力して何もしないこと
    it 'Postが見つからない場合はWARNログを出力して何もしないこと' do
      expect(Rails.logger).to receive(:warn).with(/Post not found/)
      expect do
        described_class.call('nonexistent_id')
      end.not_to raise_error
    end
  end

  describe 'dewiアダプター選択' do
    let(:post) { create(:post) }
    let(:service) { described_class.new(post.id) }

    it 'test環境ではDewiAdapterを返すこと' do
      expect(service.send(:dewi_adapter_class)).to eq(DewiAdapter)
    end

    it 'production環境かつCEREBRAS_API_KEY設定時はCerebrasAdapterを返すこと' do
      allow(Rails).to receive(:env).and_return(ActiveSupport::StringInquirer.new('production'))
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with('CEREBRAS_API_KEY').and_return('test_cerebras_key')

      expect(service.send(:dewi_adapter_class)).to eq(CerebrasAdapter)
    end
  end

  # 何を検証するか: 並列審査の実行
  describe '#execute' do
    let(:post) { create(:post) }
    let(:service) { described_class.new(post.id) }

    context '正常系' do
      # 何を検証するか: 3人全員成功時にstatus: scoredになること
      it '3人全員成功時にstatus: scoredになること' do
        mock_all_adapters_success
        allow(JudgmentQueueService).to receive(:enqueue_ogp_generation).with(instance_of(String))
        allow(LogOgpGenerationEventService).to receive(:call)

        service.execute

        post.reload
        expect(post.status).to eq('scored')
        expect(post.judges_count).to eq(3)
        expect(post.ogp_status).to eq(Post::OGP_STATUS_PENDING)
        expect(JudgmentQueueService).to have_received(:enqueue_ogp_generation).with(post.id)
        expect(LogOgpGenerationEventService).to have_received(:call).with(
          event: 'post_scored_saved',
          post: instance_of(Post),
          successful_judges_count: 3
        )
      end

      it 'scored保存後にOGP生成ジョブを投入すること' do
        mock_all_adapters_success
        allow(JudgmentQueueService).to receive(:enqueue_ogp_generation) do |post_id|
          persisted_post = Post.find(post_id)
          expect(persisted_post.status).to eq('scored')
          expect(persisted_post.ogp_status).to eq(Post::OGP_STATUS_PENDING)
        end

        service.execute

        post.reload
        expect(post.status).to eq('scored')
      end

      # 何を検証するか: 2人成功時にstatus: scoredになること
      it '2人成功時にstatus: scoredになること' do
        mock_all_adapters_success
        mock_adapter_failure(OpenAiAdapter)
        allow(JudgmentQueueService).to receive(:enqueue_ogp_generation).with(instance_of(String))

        service.execute

        post.reload
        expect(post.status).to eq('scored')
        expect(post.judges_count).to eq(2)
        expect(JudgmentQueueService).to have_received(:enqueue_ogp_generation).with(post.id)
      end

      # 何を検証するか: 平均点が小数第1位に丸められること
      it '平均点が小数第1位に丸められること（四捨五入）' do
        # 異なるスコアで平均を計算
        allow_any_instance_of(GeminiAdapter).to receive(:judge).and_return(
          create_success_response(scores: { empathy: 10, humor: 10, brevity: 10, originality: 10, expression: 10 },
                                  comment: 'test')
        )
        allow_any_instance_of(DewiAdapter).to receive(:judge).and_return(
          create_success_response(scores: { empathy: 10, humor: 10, brevity: 10, originality: 10, expression: 10 },
                                  comment: 'test')
        )
        allow_any_instance_of(OpenAiAdapter).to receive(:judge).and_return(
          create_success_response(scores: { empathy: 15, humor: 15, brevity: 15, originality: 15, expression: 15 },
                                  comment: 'test')
        )
        allow(JudgmentQueueService).to receive(:enqueue_ogp_generation).with(instance_of(String))

        service.execute

        post.reload
        # (50 + 50 + 75) / 3 = 58.333... -> 58.3
        expect(post.average_score).to eq(58.3)
      end
    end

    context '異常系' do
      it 'judging以外の投稿は再処理せずスキップすること' do
        post.update_status!(Post::STATUS_FAILED)

        expect(Rails.logger).to receive(:info).with(
          /\[JudgePostService\] スキップ\(処理済み\): post_id=#{post.id}, status=failed/
        )
        expect_any_instance_of(GeminiAdapter).not_to receive(:judge)

        service.execute
      end

      it 'claim競合時は審査をスキップすること' do
        allow(service).to receive(:claim_post_for_judging!).and_return(:claimed_by_other)
        expect(Rails.logger).to receive(:info).with(
          /\[JudgePostService\] スキップ\(claim競合\): post_id=#{post.id}, status=judging/
        )
        expect_any_instance_of(GeminiAdapter).not_to receive(:judge)
        expect_any_instance_of(DewiAdapter).not_to receive(:judge)
        expect_any_instance_of(OpenAiAdapter).not_to receive(:judge)

        service.execute

        post.reload
        expect(post.status).to eq('judging')
      end

      # 何を検証するか: 全員失敗時にstatus: failedになること
      it '全員失敗時にstatus: failedになること' do
        allow(Rails.logger).to receive(:warn)
        expect(Rails.logger).to receive(:warn).with(
          /\[JudgePostService\] 審査失敗: persona=hiroyuki, error_code=timeout, adapter=GeminiAdapter/
        )
        mock_adapter_failure(GeminiAdapter)
        mock_adapter_failure(DewiAdapter)
        mock_adapter_failure(OpenAiAdapter)
        allow(JudgmentQueueService).to receive(:enqueue_ogp_generation)

        service.execute

        post.reload
        expect(post.status).to eq('failed')
        expect(post.judges_count).to eq(0)
        expect(JudgmentQueueService).not_to have_received(:enqueue_ogp_generation)
      end

      # 何を検証するか: 1人成功時にstatus: failedになること
      it '1人成功時にstatus: failedになること' do
        mock_all_adapters_success
        mock_adapter_failure(DewiAdapter)
        mock_adapter_failure(OpenAiAdapter)
        allow(JudgmentQueueService).to receive(:enqueue_ogp_generation)

        service.execute

        post.reload
        expect(post.status).to eq('failed')
        expect(post.judges_count).to eq(1)
        expect(JudgmentQueueService).not_to have_received(:enqueue_ogp_generation)
      end

      # 何を検証するか: Postがnilの場合は何もしないこと
      it 'Postがnilの場合はWARNログを出力して何もしないこと' do
        expect(Rails.logger).to receive(:warn).with(/Post not found/)
        expect do
          service = described_class.new(nil)
          service.execute
        end.not_to raise_error
      end

      # 何を検証するか: Thread内で例外発生時に失敗として記録されること
      it 'Thread内で例外発生時に失敗として記録されること' do
        allow(Rails.logger).to receive(:error)
        error_log_pattern = Regexp.new(
          '\[JudgePostService\] 例外発生: persona=hiroyuki, adapter=GeminiAdapter, ' \
          'error_class=StandardError, message=test error'
        )
        expect(Rails.logger).to receive(:error).with(error_log_pattern)
        expect(service).to receive(:handle_thread_error).with('hiroyuki', instance_of(StandardError)).and_call_original
        allow_any_instance_of(GeminiAdapter).to receive(:judge).and_raise(StandardError.new('test error'))
        mock_adapter_judge(DewiAdapter, success: true)
        mock_adapter_judge(OpenAiAdapter, success: true)

        service.execute

        post.reload
        expect(post.status).to eq('scored') # 2人成功なのでscored
        expect(post.judges_count).to eq(2)
      end
    end

    context '境界値・タイムアウト' do
      # 何を検証するか: タイムアウト発生時にerror_code: timeoutになること
      it 'タイムアウト発生時にerror_code: timeoutになること' do
        stub_const('JudgePostService::PER_JUDGE_TIMEOUT', 0.05)
        expect(service).to receive(:handle_timeout).with('hiroyuki').and_call_original

        timeout_future = instance_double(Concurrent::Future)
        dewi_future = instance_double(Concurrent::Future)
        nakao_future = instance_double(Concurrent::Future)

        allow(Concurrent::Future).to receive(:execute).and_return(timeout_future, dewi_future, nakao_future)
        allow(timeout_future).to receive(:value).with(0.05).and_return(nil)
        allow(dewi_future).to receive(:value).with(0.05).and_return(
          {
            persona: 'dewi',
            result: create_success_response(
              scores: { empathy: 15, humor: 15, brevity: 15, originality: 15, expression: 15 },
              comment: 'test'
            )
          }
        )
        allow(nakao_future).to receive(:value).with(0.05).and_return(
          {
            persona: 'nakao',
            result: create_success_response(
              scores: { empathy: 15, humor: 15, brevity: 15, originality: 15, expression: 15 },
              comment: 'test'
            )
          }
        )

        service.execute

        # タイムアウトしたJudgmentを確認（AWS SDKを直接使用）
        timeout_judgment = find_judgment_by_aws(post.id, 'hiroyuki')
        expect(timeout_judgment.error_code).to eq('timeout')
      end

      it 'OGP生成ジョブ投入に失敗しても審査結果はscoredのまま継続すること' do
        mock_all_adapters_success
        allow(JudgmentQueueService).to receive(:enqueue_ogp_generation).and_raise(StandardError, 'queue failed')
        expect(Rails.logger).to receive(:warn).with(
          /\[JudgePostService\] OGP画像生成ジョブ投入で例外: post_id=#{post.id} error=StandardError - queue failed/
        )

        service.execute

        post.reload
        expect(post.status).to eq('scored')
        expect(post.judges_count).to eq(3)
        expect(post.ogp_status).to eq(Post::OGP_STATUS_FAILED)
      end

      # 何を検証するか: 混合パターンで正しくステータスが決まること
      it '混合パターンで正しくステータスが決まること' do
        mock_all_adapters_success
        mock_adapter_failure(DewiAdapter, error_code: 'provider_error')
        allow_any_instance_of(OpenAiAdapter).to receive(:judge).and_raise(StandardError.new('test'))

        service.execute

        post.reload
        expect(post.status).to eq('failed') # 1人成功のみ
        expect(post.judges_count).to eq(1)
      end
    end

    # 何を検証するか: 並列実行の検証
    it '3人の審査員が同時に実行されること' do
      start_times = {}

      [GeminiAdapter, DewiAdapter, OpenAiAdapter].each do |adapter_class|
        allow_any_instance_of(adapter_class).to receive(:judge) do
          start_times[adapter_class] = Time.zone.now
          create_success_response(scores: { empathy: 15, humor: 15, brevity: 15, originality: 15, expression: 15 },
                                  comment: 'test')
        end
      end

      service.execute

      # 全ての開始時刻が0.2秒以内であることを確認（並列実行の証明）
      times = start_times.values
      expect(times.size).to eq(3)
      expect(times.max - times.min).to be < 0.2
    end
  end

  # 何を検証するか: 審査結果の保存
  describe '#save_judgments!' do
    let(:post) { create(:post) }
    let(:service) { described_class.new(post.id) }

    it '成功した審査結果がJudgmentテーブルに保存されること' do
      mock_adapter_judge(GeminiAdapter, success: true)
      mock_adapter_judge(DewiAdapter, success: true)
      mock_adapter_judge(OpenAiAdapter, success: false)

      service.execute

      # AWS SDKを直接使用してクエリ
      judgments = query_judgments_by_post_id(post.id)
      successful_judgments = judgments.select(&:succeeded)

      expect(successful_judgments.size).to eq(2)
      expect(successful_judgments.map(&:persona)).to contain_exactly('hiroyuki', 'dewi')
    end

    it '失敗した審査結果もJudgmentテーブルに保存されること' do
      mock_adapter_judge(GeminiAdapter, success: true)
      mock_adapter_judge(DewiAdapter, success: false)
      mock_adapter_judge(OpenAiAdapter, success: false)

      service.execute

      # AWS SDKを直接使用してクエリ
      judgments = query_judgments_by_post_id(post.id)
      failed_judgments = judgments.reject(&:succeeded)

      expect(failed_judgments.size).to eq(2)
    end
  end

  # 何を検証するか: ステータス更新
  describe '#update_post_status!' do
    let(:post) { create(:post) }
    let(:service) { described_class.new(post.id) }

    context 'scoredの場合' do
      it '2人以上成功時にstatus: scoredになること' do
        mock_adapter_judge(GeminiAdapter, success: true)
        mock_adapter_judge(DewiAdapter, success: true)
        mock_adapter_judge(OpenAiAdapter, success: false)

        service.execute

        post.reload
        expect(post.status).to eq('scored')
        expect(post.average_score).to be_present
      end
    end

    context 'failedの場合' do
      it '1人成功時にstatus: failedになること' do
        mock_adapter_judge(GeminiAdapter, success: true)
        mock_adapter_judge(DewiAdapter, success: false)
        mock_adapter_judge(OpenAiAdapter, success: false)

        service.execute

        post.reload
        expect(post.status).to eq('failed')
        expect(post.average_score).to be_nil
      end
    end
  end

  describe 'privateメソッド' do
    let(:post) { create(:post) }
    let(:service) { described_class.new(post.id) }

    describe '#resolve_adapter_class' do
      it 'Class指定時はそのまま返すこと' do
        expect(service.send(:resolve_adapter_class, GeminiAdapter)).to eq(GeminiAdapter)
      end

      it 'Symbol指定時は対応するメソッドから解決すること' do
        expect(service.send(:resolve_adapter_class, :dewi_adapter_class)).to eq(DewiAdapter)
      end
    end

    describe '#shutdown_executor' do
      let(:executor) { instance_double(Concurrent::ThreadPoolExecutor) }

      it '正常に停止した場合はkillを実行しないこと' do
        service.instance_variable_set(:@executor, executor)

        expect(executor).to receive(:shutdown)
        expect(executor).to receive(:wait_for_termination)
          .with(described_class::EXECUTOR_SHUTDOWN_WAIT_SECONDS).and_return(true)
        expect(executor).not_to receive(:kill)
        expect(Rails.logger).not_to receive(:warn).with('[JudgePostService] Executor killed after timeout')

        service.send(:shutdown_executor)
      end

      it '停止待機がタイムアウトした場合はkillを実行すること' do
        service.instance_variable_set(:@executor, executor)

        expect(executor).to receive(:shutdown)
        expect(executor).to receive(:wait_for_termination)
          .with(described_class::EXECUTOR_SHUTDOWN_WAIT_SECONDS).and_return(false)
        expect(executor).to receive(:kill)
        expect(Rails.logger).to receive(:warn).with('[JudgePostService] Executor killed after timeout')

        service.send(:shutdown_executor)
      end
    end
  end
end
