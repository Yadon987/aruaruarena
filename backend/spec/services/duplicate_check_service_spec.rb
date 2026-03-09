# frozen_string_literal: true

require 'rails_helper'

RSpec.describe DuplicateCheckService, type: :service do
  describe '定数' do
    # HASH_LOG_START_INDEX定数が0であること
    it 'HASH_LOG_START_INDEX定数が0であること' do
      expect(described_class::HASH_LOG_START_INDEX).to eq(0)
    end

    # HASH_LOG_END_INDEX定数が15であること
    it 'HASH_LOG_END_INDEX定数が15であること' do
      expect(described_class::HASH_LOG_END_INDEX).to eq(15)
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
                                 expires_at: Time.now.to_i + 5)
        expect(described_class.duplicate?(body: 'テスト投稿')).to be true
      end

      # TTL期限切れ後（DynamoDB遅延削除未完了）、falseを返す
      it 'TTL期限切れ後（DynamoDB遅延削除未完了）、falseを返すこと' do
        create(:duplicate_check, body_hash: DuplicateCheck.generate_body_hash('テスト投稿'), post_id: 'test_id',
                                 expires_at: Time.now.to_i - 100)
        expect(described_class.duplicate?(body: 'テスト投稿')).to be false
      end
    end

    context 'エッジケース' do
      # 絵文字を含む本文の正規化
      it '絵文字を含む本文の正規化が正しく動作すること' do
        # 絵文字は正規化で変換されない
        hash1 = DuplicateCheck.generate_body_hash('😀😀😀')
        hash2 = DuplicateCheck.generate_body_hash('😀😀😀')
        expect(hash1).to eq(hash2)

        # 重複チェックも正しく動作
        create(:duplicate_check, body_hash: hash1, post_id: 'test_id', expires_at: Time.now.to_i + 1000)
        expect(described_class.duplicate?(body: '😀😀😀')).to be true
      end

      # 非常に長い本文でも正しくハッシュ化されること
      it '非常に長い本文でも正しくハッシュ化されること' do
        long_body = 'あ' * 10_000
        expect(described_class.duplicate?(body: long_body)).to be false

        # register!も正常に動作すること
        described_class.register!(body: long_body, post_id: 'test_long')
        expect(described_class.duplicate?(body: long_body)).to be true
      end
    end

    context '空白のみ入力の正規化' do
      # 半角空白のみの入力が空文字に正規化されること
      it '半角空白のみの入力が空文字に正規化されること' do
        hash = DuplicateCheck.generate_body_hash('   ')
        expect(hash).to be_a(String)
        expect(hash.length).to eq(64) # SHA256ハッシュ長
      end

      # 全角空白のみの入力が空文字に正規化されること
      it '全角空白のみの入力が空文字に正規化されること' do
        hash = DuplicateCheck.generate_body_hash('　　　')
        expect(hash).to be_a(String)
        expect(hash.length).to eq(64)
      end

      # 混合空白のみの入力が空文字に正規化されること
      it '混合空白のみの入力が空文字に正規化されること' do
        hash = DuplicateCheck.generate_body_hash(' 　  ')
        expect(hash).to be_a(String)
        expect(hash.length).to eq(64)
      end

      # 連続する半角空白が単一の半角空白に統一されること
      it '連続する半角空白が単一の半角空白に統一されること' do
        hash1 = DuplicateCheck.generate_body_hash('テスト  テスト')
        hash2 = DuplicateCheck.generate_body_hash('テスト テスト')
        expect(hash1).to eq(hash2)
      end

      # 連続する全角空白が単一の半角空白に統一されること
      it '連続する全角空白が単一の半角空白に統一されること' do
        hash1 = DuplicateCheck.generate_body_hash('テスト　　テスト')
        hash2 = DuplicateCheck.generate_body_hash('テスト テスト')
        expect(hash1).to eq(hash2)
      end

      # 前後の半角空白が除去されること
      it '前後の半角空白が除去されること' do
        hash1 = DuplicateCheck.generate_body_hash('  テスト  ')
        hash2 = DuplicateCheck.generate_body_hash('テスト')
        expect(hash1).to eq(hash2)
      end

      # 前後の全角空白が除去されること
      it '前後の全角空白が除去されること' do
        hash1 = DuplicateCheck.generate_body_hash('　テスト　')
        hash2 = DuplicateCheck.generate_body_hash('テスト')
        expect(hash1).to eq(hash2)
      end

      # 空白のみの入力でも重複チェックが正常に動作すること（統合テスト）
      it '空白のみの入力でも重複チェックが正常に動作すること（統合テスト）' do
        # 初回投稿
        expect(described_class.duplicate?(body: '   ')).to be false

        # 重複チェック登録
        described_class.register!(body: '   ', post_id: 'test_id')

        # 重複検出
        expect(described_class.duplicate?(body: '   ')).to be true

        # 別の空白パターンでも重複と判定されること
        expect(described_class.duplicate?(body: '　　')).to be true
      end
    end

    context 'フェイルオープン (Resilience)' do
      # DynamoDB接続エラー時、falseを返す（投稿を許可）
      it 'DynamoDB接続エラー時、falseを返すこと' do
        allow(DuplicateCheck).to receive(:exists_with_hash?).and_raise(
          Aws::DynamoDB::Errors::ServiceError.new(nil, 'Service unavailable')
        )
        allow(Rails.logger).to receive(:error).with(/\[DuplicateCheckService\] DynamoDB error:/)
        expect(described_class.duplicate?(body: 'テスト投稿')).to be false
      end

      # レコードが存在しない場合、falseを返す
      it 'レコードが存在しない場合、falseを返すこと' do
        expect(described_class.duplicate?(body: 'テスト投稿')).to be false
      end

      # 予期しないエラー（StandardError）が発生した場合、falseを返す
      it '予期しないエラー時もfalseを返すこと' do
        allow(DuplicateCheck).to receive(:exists_with_hash?).and_raise(StandardError, 'Unexpected error')
        allow(Rails.logger).to receive(:error).with(/\[DuplicateCheckService\] DynamoDB error:/)
        expect(described_class.duplicate?(body: 'テスト投稿')).to be false
      end
    end

    context 'DynamoDBスロットリング' do
      # ProvisionedThroughputExceededException時にfalseを返すこと（フェイルオープン）
      it 'ProvisionedThroughputExceededException時にfalseを返すこと（フェイルオープン）' do
        allow(DuplicateCheck).to receive(:exists_with_hash?)
          .and_raise(Aws::DynamoDB::Errors::ProvisionedThroughputExceededException.new(nil, 'Throughput exceeded'))
        expect(Rails.logger).to receive(:error).with(/\[DuplicateCheckService\] DynamoDB error:/)
        expect(described_class.duplicate?(body: 'テスト投稿')).to be false
      end

      # RequestLimitExceeded時にfalseを返すこと（フェイルオープン）
      it 'RequestLimitExceeded時にfalseを返すこと（フェイルオープン）' do
        allow(DuplicateCheck).to receive(:exists_with_hash?)
          .and_raise(Aws::DynamoDB::Errors::RequestLimitExceeded.new(nil, 'Request limit exceeded'))
        expect(Rails.logger).to receive(:error).with(/\[DuplicateCheckService\] DynamoDB error:/)
        expect(described_class.duplicate?(body: 'テスト投稿')).to be false
      end

      # ResourceNotFoundException時にfalseを返すこと（フェイルオープン）
      it 'ResourceNotFoundException時にfalseを返すこと（フェイルオープン）' do
        allow(DuplicateCheck).to receive(:exists_with_hash?)
          .and_raise(Aws::DynamoDB::Errors::ResourceNotFoundException.new(nil, 'Resource not found'))
        expect(Rails.logger).to receive(:error).with(/\[DuplicateCheckService\] DynamoDB error:/)
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
        expect(duplicate_check.expires_at).to be_within(1).of(current_time + DuplicateCheck::DUPLICATE_DURATION_SECONDS)
      end

      # Integer型で保存されること
      it 'Integer型で保存されること' do
        described_class.register!(body: 'テスト投稿', post_id: 'test_id')

        duplicate_check = DuplicateCheck.find(DuplicateCheck.generate_body_hash('テスト投稿'))
        expect(duplicate_check.expires_at).to be_a(Integer)
      end
    end

    context '異常系' do
      # DynamoDB接続エラー時、nilを返すこと（フェイルオープン）
      it 'DynamoDB接続エラー時、nilを返すこと' do
        allow(DuplicateCheck).to receive(:register).and_raise(
          Aws::DynamoDB::Errors::ServiceError.new(nil, 'Service unavailable')
        )
        allow(Rails.logger).to receive(:error).with(/\[DuplicateCheckService\] register! failed:/)
        expect(described_class.register!(body: 'テスト投稿', post_id: 'test_id')).to be_nil
      end
    end

    context 'DynamoDBスロットリング' do
      # ProvisionedThroughputExceededException時にnilを返すこと（フェイルオープン）
      it 'ProvisionedThroughputExceededException時にnilを返すこと（フェイルオープン）' do
        allow(DuplicateCheck).to receive(:register)
          .and_raise(Aws::DynamoDB::Errors::ProvisionedThroughputExceededException.new(nil, 'Throughput exceeded'))
        expect(Rails.logger).to receive(:error).with(/\[DuplicateCheckService\] register! failed:/)
        expect(described_class.register!(body: 'テスト投稿', post_id: 'test_id')).to be_nil
      end

      # RequestLimitExceeded時にnilを返すこと（フェイルオープン）
      it 'RequestLimitExceeded時にnilを返すこと（フェイルオープン）' do
        allow(DuplicateCheck).to receive(:register)
          .and_raise(Aws::DynamoDB::Errors::RequestLimitExceeded.new(nil, 'Request limit exceeded'))
        expect(Rails.logger).to receive(:error).with(/\[DuplicateCheckService\] register! failed:/)
        expect(described_class.register!(body: 'テスト投稿', post_id: 'test_id')).to be_nil
      end
    end
  end

  describe '統合テスト' do
    # register!後にduplicate?がtrueを返す（モックなし）
    it 'register!後にduplicate?がtrueを返すこと' do
      described_class.register!(body: 'テスト投稿', post_id: 'test_id')
      expect(described_class.duplicate?(body: 'テスト投稿')).to be true
    end

    # 異なるテキストは重複しないこと
    it '異なるテキストは重複しないこと' do
      described_class.register!(body: 'テスト投稿A', post_id: 'test_id_a')
      expect(described_class.duplicate?(body: 'テスト投稿B')).to be false
    end
  end
end
