# frozen_string_literal: true

require 'rails_helper'

# Issue: E06-05
RSpec.describe JudgePostService do
  # AdapterTestHelpersのメソッドを使用
  include AdapterTestHelpers

  # DynamoDBテストヘルパーをinclude
  include DynamoDBTestHelpers

  # 各テスト前にJudgmentをクリーンアップ
  before(:each) do
    # DynamoDB Localの整合性問題を回避するため、確実に削除
    cleanup_judgments_table
  end

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
      expect(described_class::JOIN_TIMEOUT).to eq(120)
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

  # 何を検証するか: 並列審査の実行
  describe '#execute' do
    let!(:post) { create(:post) }
    let(:service) { described_class.new(post.id) }

    context '正常系' do
      # 何を検証するか: 3人全員成功時にstatus: scoredになること
      it '3人全員成功時にstatus: scoredになること' do
        mock_adapter_judge(GeminiAdapter, success: true)
        mock_adapter_judge(DewiAdapter, success: true)
        mock_adapter_judge(OpenAiAdapter, success: true)

        service.execute

        post.reload
        expect(post.status).to eq('scored')
        expect(post.judges_count).to eq(3)
      end

      # 何を検証するか: 2人成功時にstatus: scoredになること
      it '2人成功時にstatus: scoredになること' do
        mock_adapter_judge(GeminiAdapter, success: true)
        mock_adapter_judge(DewiAdapter, success: true)
        mock_adapter_judge(OpenAiAdapter, success: false)

        service.execute

        post.reload
        expect(post.status).to eq('scored')
        expect(post.judges_count).to eq(2)
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

        service.execute

        post.reload
        # (50 + 50 + 75) / 3 = 58.333... -> 58.3
        expect(post.average_score).to eq(58.3)
      end
    end

    context '異常系' do
      # 何を検証するか: 全員失敗時にstatus: failedになること
      it '全員失敗時にstatus: failedになること' do
        mock_adapter_judge(GeminiAdapter, success: false)
        mock_adapter_judge(DewiAdapter, success: false)
        mock_adapter_judge(OpenAiAdapter, success: false)

        service.execute

        post.reload
        expect(post.status).to eq('failed')
        expect(post.judges_count).to eq(0)
      end

      # 何を検証するか: 1人成功時にstatus: failedになること
      it '1人成功時にstatus: failedになること' do
        mock_adapter_judge(GeminiAdapter, success: true)
        mock_adapter_judge(DewiAdapter, success: false)
        mock_adapter_judge(OpenAiAdapter, success: false)

        service.execute

        post.reload
        expect(post.status).to eq('failed')
        expect(post.judges_count).to eq(1)
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
        # テスト用にタイムアウトを短縮
        stub_const('JudgePostService::PER_JUDGE_TIMEOUT', 1)

        # sleepでタイムアウトを発生させる
        allow_any_instance_of(GeminiAdapter).to receive(:judge) do
          sleep(2) # PER_JUDGE_TIMEOUT = 1秒を超える
          create_success_response(scores: { empathy: 15, humor: 15, brevity: 15, originality: 15, expression: 15 },
                                  comment: 'test')
        end
        mock_adapter_judge(DewiAdapter, success: true)
        mock_adapter_judge(OpenAiAdapter, success: true)

        service.execute

        # タイムアウトしたJudgmentを確認（AWS SDKを直接使用）
        timeout_judgment = find_judgment_by_aws(post.id, 'hiroyuki')
        expect(timeout_judgment.error_code).to eq('timeout')
      end

      # 何を検証するか: 混合パターンで正しくステータスが決まること
      it '混合パターンで正しくステータスが決まること' do
        mock_adapter_judge(GeminiAdapter, success: true)
        allow_any_instance_of(DewiAdapter).to receive(:judge).and_return(
          create_api_error_response(error_code: 'provider_error')
        )
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
          sleep(0.1)
          create_success_response(scores: { empathy: 15, humor: 15, brevity: 15, originality: 15, expression: 15 },
                                  comment: 'test')
        end
      end

      service.execute

      # 全ての開始時刻が0.2秒以内であることを確認（並列実行の証明）
      times = start_times.values
      expect(times.max - times.min).to be < 0.2
    end
  end

  # 何を検証するか: 審査結果の保存
  describe '#save_judgments!' do
    let!(:post) { create(:post) }
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
    let!(:post) { create(:post) }
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
end
