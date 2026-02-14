# frozen_string_literal: true

require 'rails_helper'

RSpec.describe DuplicateCheckService, type: :service do
  describe '定数' do
    # DUPLICATE_DURATION_HOURS定数が24時間で定義されていること
    it 'DUPLICATE_DURATION_HOURS定数が24時間であること' do
      expect(described_class::DUPLICATE_DURATION_HOURS).to eq(24)
    end
  end

  describe '.duplicate?' do
    context '正常系 (Happy Path)' do
      # 重複していない場合、falseを返す
      it '重複していない場合、falseを返すこと' do
        expect(described_class.duplicate?(body: 'テスト投稿')).to be false
      end
    end

    context '異常系 (Error Path)' do
      # 24時間以内に同一内容の投稿がある場合、trueを返す
      it '24時間以内に同一内容の投稿がある場合、trueを返すこと' do
        create(:duplicate_check, body_hash: DuplicateCheck.generate_body_hash('テスト投稿'), post_id: 'test_id',
                                 expires_at: Time.now.to_i + 1000)
        expect(described_class.duplicate?(body: 'テスト投稿')).to be true
      end

      # 異なる正規化で同一内容の投稿がある場合、trueを返す
      it '異なる正規化で同一内容の投稿がある場合、trueを返すこと' do
        create(:duplicate_check, body_hash: DuplicateCheck.generate_body_hash('ＡＣＣｃｓ　トウコウ　'), post_id: 'test_id',
                                 expires_at: Time.now.to_i + 1000)
        expect(described_class.duplicate?(body: 'ＡＣＣｃｓ　トウコウ　')).to be true
      end
    end

    context '境界値 (Edge Case)' do
      # 24時間経過後（expires_at == 現在時刻）、falseを返す
      it '24時間経過後（expires_at == 現在時刻）、falseを返すこと' do
        create(:duplicate_check, body_hash: DuplicateCheck.generate_body_hash('テスト投稿'), post_id: 'test_id',
                                 expires_at: Time.now.to_i)
        expect(described_class.duplicate?(body: 'テスト投稿')).to be false
      end

      # 24時間+1秒経過後（expires_at < 現在時刻）、falseを返す
      it '24時間+1秒経過後（expires_at < 現在時刻）、falseを返すこと' do
        create(:duplicate_check, body_hash: DuplicateCheck.generate_body_hash('テスト投稿'), post_id: 'test_id',
                                 expires_at: Time.now.to_i - 1)
        expect(described_class.duplicate?(body: 'テスト投稿')).to be false
      end

      # 24時間-1秒前（expires_at > 現在時刻）、trueを返す
      it '24時間-1秒前（expires_at > 現在時刻）、trueを返すこと' do
        create(:duplicate_check, body_hash: DuplicateCheck.generate_body_hash('テスト投稿'), post_id: 'test_id',
                                 expires_at: Time.now.to_i + 1)
        expect(described_class.duplicate?(body: 'テスト投稿')).to be true
      end

      # TTL期限切れ後（DynamoDB遅延削除未完了）、falseを返す
      it 'TTL期限切れ後（DynamoDB遅延削除未完了）、falseを返すこと' do
        create(:duplicate_check, body_hash: DuplicateCheck.generate_body_hash('テスト投稿'), post_id: 'test_id',
                                 expires_at: Time.now.to_i - 100)
        expect(described_class.duplicate?(body: 'テスト投稿')).to be false
      end
    end

    context 'フェイルオープン (Resilience)' do
      # DynamoDB接続エラー時、falseを返す（投稿を許可）
      it 'DynamoDB接続エラー時、falseを返すこと' do
        allow(DuplicateCheck).to receive(:find).and_raise(Aws::DynamoDB::Errors::ServiceError.new(nil,
                                                                                                  'Service unavailable'))
        allow(Rails.logger).to receive(:error).with(/\[DuplicateCheck#check\] DynamoDB error:/)
        expect(described_class.duplicate?(body: 'テスト投稿')).to be false
      end

      # レコードが存在しない場合、falseを返す
      it 'レコードが存在しない場合、falseを返すこと' do
        expect(described_class.duplicate?(body: 'テスト投稿')).to be false
      end

      # 予期しないエラー（StandardError）が発生した場合、falseを返す
      it '予期しないエラー時もfalseを返すこと' do
        allow(DuplicateCheck).to receive(:find).and_raise(StandardError, 'Unexpected error')
        allow(Rails.logger).to receive(:error).with(/\[DuplicateCheck#check\] DynamoDB error:/)
        expect(described_class.duplicate?(body: 'テスト投稿')).to be false
      end
    end
  end

  describe '.register!' do
    context '正常系' do
      # 投稿成功後に重複チェックレコードが作成される
      it '重複チェックレコードが作成されること' do
        expect do
          described_class.register!(body: 'テスト投稿', post_id: 'test_id')
        end.to change(DuplicateCheck, :count).by(1)

        duplicate_check = DuplicateCheck.find(DuplicateCheck.generate_body_hash('テスト投稿'))
        expect(duplicate_check).to be_present
        expect(duplicate_check.post_id).to eq('test_id')
      end

      # expires_atが現在時刻+86400秒（24時間）に設定されること
      it 'expires_atが現在時刻+86400秒（24時間）に設定されること' do
        current_time = Time.now.to_i
        described_class.register!(body: 'テスト投稿', post_id: 'test_id')

        duplicate_check = DuplicateCheck.find(DuplicateCheck.generate_body_hash('テスト投稿'))
        expect(duplicate_check.expires_at).to be_within(1).of(current_time + 86_400)
      end

      # Integer型で保存されること
      it 'Integer型で保存されること' do
        allow(DuplicateCheck).to receive(:register).and_call_original
        described_class.register!(body: 'テスト投稿', post_id: 'test_id')

        duplicate_check = DuplicateCheck.find(DuplicateCheck.generate_body_hash('テスト投稿'))
        expect(duplicate_check.expires_at).to be_a(Integer)
      end
    end

    context '異常系' do
      # DynamoDB接続エラー時、nilを返すこと（フェイルオープン）
      it 'DynamoDB接続エラー時、nilを返すこと' do
        allow(DuplicateCheck).to receive(:register).and_raise(Aws::DynamoDB::Errors::ServiceError.new(nil,
                                                                                                      'Service unavailable'))
        allow(Rails.logger).to receive(:error).with(/\[DuplicateCheckService\] register! failed:/)
        expect(described_class.register!(body: 'テスト投稿', post_id: 'test_id')).to be_nil
      end
    end
  end

  describe '統合テスト' do
    # register!後にduplicate?がtrueを返す
    it 'register!後にduplicate?がtrueを返すこと' do
      allow(DuplicateCheck).to receive(:register).and_call_original
      allow(DuplicateCheck).to receive(:find).and_return(double('duplicate_check', expires_at: Time.now.to_i + 1000))

      described_class.register!(body: 'テスト投稿', post_id: 'test_id')
      expect(described_class.duplicate?(body: 'テスト投稿')).to be true
    end
  end
end
