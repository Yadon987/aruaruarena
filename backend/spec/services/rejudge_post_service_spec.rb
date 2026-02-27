# frozen_string_literal: true

require 'rails_helper'

# Issue: E11-01
RSpec.describe 'RejudgePostService', type: :service do
  include AdapterTestHelpers
  include DynamoDBTestHelpers

  let(:service_class) { Object.const_get('RejudgePostService') }

  before(:each) do
    cleanup_judgments_table
  end

  describe '.call' do
    # 何を検証するか: Postが存在しない場合はWARNログを出力して安全に終了すること
    it '存在しないPost IDでも例外を出さずに終了する' do
      expect(Rails.logger).to receive(:warn).with(/Post not found/)

      expect do
        service_class.call('nonexistent_id', failed_personas: ['dewi'])
      end.not_to raise_error
    end

    # 何を検証するか: 無効なpersona入力をバリデーションで拒否すること
    it '無効なpersonaを含むとArgumentErrorを送出する' do
      post_record = create(:post, :failed, judges_count: 1)

      expect do
        service_class.call(post_record.id, failed_personas: ['invalid'])
      end.to raise_error(ArgumentError)
    end

    # 何を検証するか: 重複したpersona指定を入力エラーとして拒否すること
    it '重複したpersonaを含むとArgumentErrorを送出する' do
      post_record = create(:post, :failed, judges_count: 1)

      expect do
        service_class.call(post_record.id, failed_personas: %w[dewi dewi])
      end.to raise_error(ArgumentError)
    end
  end

  describe 'dewiアダプター選択' do
    let!(:post_record) { create(:post, :failed, judges_count: 1) }
    let(:service) { service_class.new(post_record.id, failed_personas: ['dewi']) }

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

  describe '#execute' do
    context '正常系' do
      # 何を検証するか: 指定personaのみ再審査し、既存の成功Judgmentを保持すること
      it 'dewiのみ再審査し、既存成功Judgmentを保持してstatusがscoredになる' do
        post_record = create(:post, :failed, judges_count: 1)
        create(:judgment, :hiroyuki, post_id: post_record.id, succeeded: true, total_score: 80)
        create(:judgment, :dewi, :failed, post_id: post_record.id, error_code: 'timeout')

        allow_any_instance_of(DewiAdapter).to receive(:judge).and_return(
          create_success_response(
            scores: { empathy: 16, humor: 15, brevity: 14, originality: 15, expression: 16 },
            comment: '再審査成功'
          )
        )

        service_class.new(post_record.id, failed_personas: ['dewi']).execute

        post_record.reload
        judgments = query_judgments_by_post_id(post_record.id)
        personas = judgments.map(&:persona)

        expect(personas).to include('hiroyuki', 'dewi')
        expect(post_record.status).to eq('scored')
      end

      # 何を検証するか: 複数personaの再審査成功時に平均点を再計算してscoredになること
      it 'dewiとnakaoを再審査してstatusとaverage_scoreを更新する' do
        post_record = create(:post, :failed, judges_count: 1)
        create(:judgment, :hiroyuki, post_id: post_record.id, succeeded: true, total_score: 78)
        create(:judgment, :dewi, :failed, post_id: post_record.id, error_code: 'timeout')
        create(:judgment, :nakao, :failed, post_id: post_record.id, error_code: 'provider_error')

        allow_any_instance_of(DewiAdapter).to receive(:judge).and_return(
          create_success_response(
            scores: { empathy: 15, humor: 16, brevity: 14, originality: 15, expression: 16 },
            comment: '再審査成功'
          )
        )
        allow_any_instance_of(OpenAiAdapter).to receive(:judge).and_return(
          create_success_response(
            scores: { empathy: 14, humor: 15, brevity: 16, originality: 15, expression: 16 },
            comment: '再審査成功'
          )
        )

        service_class.new(post_record.id, failed_personas: %w[dewi nakao]).execute

        post_record.reload
        expect(post_record.status).to eq('scored')
        expect(post_record.average_score).to be_present
      end
    end

    context '異常系' do
      # 何を検証するか: 再審査対象が全員失敗した場合はfailedを維持すること
      it '再審査対象が全員失敗した場合はstatusがfailedのままになる' do
        post_record = create(:post, :failed, judges_count: 1)
        create(:judgment, :hiroyuki, post_id: post_record.id, succeeded: true, total_score: 78)
        create(:judgment, :dewi, :failed, post_id: post_record.id, error_code: 'timeout')
        create(:judgment, :nakao, :failed, post_id: post_record.id, error_code: 'provider_error')

        allow_any_instance_of(DewiAdapter).to receive(:judge).and_return(create_timeout_response)
        allow_any_instance_of(OpenAiAdapter).to receive(:judge).and_return(create_timeout_response)

        service_class.new(post_record.id, failed_personas: %w[dewi nakao]).execute

        post_record.reload
        expect(post_record.status).to eq('failed')
      end

      # 何を検証するか: Post更新失敗時にJudgmentとPostが実行前状態へ復元されること
      it 'update_post_status!で例外発生時にロールバックされる' do
        post_record = create(:post, :failed, judges_count: 1, average_score: nil)
        create(:judgment, :hiroyuki, post_id: post_record.id, succeeded: true, total_score: 78)
        create(:judgment, :dewi, :failed, post_id: post_record.id, error_code: 'timeout')
        dewi_before = find_judgment_by_aws(post_record.id, 'dewi')
        before_post_status = post_record.status
        before_judges_count = post_record.judges_count

        allow_any_instance_of(DewiAdapter).to receive(:judge).and_return(
          create_success_response(
            scores: { empathy: 16, humor: 15, brevity: 14, originality: 15, expression: 16 },
            comment: '再審査成功'
          )
        )

        service = service_class.new(post_record.id, failed_personas: ['dewi'])
        allow(service).to receive(:update_post_status!).and_raise(StandardError.new('forced_error'))

        expect { service.execute }.to raise_error(StandardError, 'forced_error')

        post_record.reload
        dewi_after = find_judgment_by_aws(post_record.id, 'dewi')
        expect(post_record.status).to eq(before_post_status)
        expect(post_record.judges_count).to eq(before_judges_count)
        expect(dewi_after.succeeded).to eq(dewi_before.succeeded)
        expect(dewi_after.error_code).to eq(dewi_before.error_code)
      end
    end

    context '境界値' do
      # 何を検証するか: 既存Judgmentがないpersonaでも再審査で新規作成されること
      it '対象personaのJudgmentが未作成でも新規作成される' do
        post_record = create(:post, :failed, judges_count: 1)
        create(:judgment, :hiroyuki, post_id: post_record.id, succeeded: true, total_score: 80)
        allow_any_instance_of(DewiAdapter).to receive(:judge).and_return(
          create_success_response(
            scores: { empathy: 15, humor: 16, brevity: 14, originality: 15, expression: 16 },
            comment: '再審査成功'
          )
        )

        service_class.new(post_record.id, failed_personas: ['dewi']).execute

        dewi = find_judgment_by_aws(post_record.id, 'dewi')
        expect(dewi).to be_present
        expect(dewi.succeeded).to be true
      end
    end
  end
end
