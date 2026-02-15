# frozen_string_literal: true

require 'rails_helper'

RSpec.describe RateLimiterService, type: :service do
  # 何を検証するか: 定数が定義されていること
  describe '定数' do
    it 'LIMIT_DURATION定数が300秒で定義されていること' do
      expect(described_class::LIMIT_DURATION).to eq(300)
    end
  end

  # 何を検証するか: 制限チェックの正常系・異常系・境界値
  describe '.limited?' do
    let(:ip) { '192.168.1.1' }
    let(:nickname) { '太郎' }
    let(:ip_identifier) { RateLimit.generate_ip_identifier(ip) }
    let(:nickname_identifier) { RateLimit.generate_nickname_identifier(nickname) }
    let(:current_time) { Time.now.to_i }

    context '正常系 (Happy Path)' do
      # Given: IP・ニックネームともに制限なし
      # When: limited?を呼び出す
      # Then: falseを返す
      it '制限されていない場合、falseを返すこと' do
        expect(described_class.limited?(ip: ip, nickname: nickname)).to be false
      end
    end

    context '異常系 (Error Path)' do
      # Given: IPが制限中
      # When: limited?を呼び出す
      # Then: trueを返す（ニックネームは未制限でも）
      it 'IP制限中の場合、trueを返すこと' do
        create(:rate_limit, identifier: ip_identifier, expires_at: current_time + 300)
        expect(described_class.limited?(ip: ip, nickname: nickname)).to be true
      end

      # Given: ニックネームが制限中
      # When: limited?を呼び出す
      # Then: trueを返す（IPは未制限でも）
      it 'ニックネーム制限中の場合、trueを返すこと' do
        create(:rate_limit, identifier: nickname_identifier, expires_at: current_time + 300)
        expect(described_class.limited?(ip: ip, nickname: nickname)).to be true
      end

      # Given: IP・ニックネーム両方が制限中
      # When: limited?を呼び出す
      # Then: trueを返す
      it 'IPとニックネーム両方が制限中の場合、trueを返すこと' do
        create(:rate_limit, identifier: ip_identifier, expires_at: current_time + 300)
        create(:rate_limit, identifier: nickname_identifier, expires_at: current_time + 300)
        expect(described_class.limited?(ip: ip, nickname: nickname)).to be true
      end
    end

    context '境界値 (Edge Case)' do
      # Given: expires_atが現在時刻と同じ
      # When: limited?を呼び出す
      # Then: falseを返す（expires_at > Time.now.to_iではないため）
      it 'expires_atが現在時刻と同じ場合、falseを返すこと' do
        create(:rate_limit, identifier: ip_identifier, expires_at: current_time)
        expect(described_class.limited?(ip: ip, nickname: nickname)).to be false
      end

      # Given: expires_atが現在時刻+1秒
      # When: limited?を呼び出す
      # Then: trueを返す
      it 'expires_atが現在時刻+1秒の場合、trueを返すこと' do
        create(:rate_limit, identifier: ip_identifier, expires_at: current_time + 1)
        expect(described_class.limited?(ip: ip, nickname: nickname)).to be true
      end

      # Given: レコードは存在するがexpires_at < 現在時刻（TTL遅延削除）
      # When: limited?を呼び出す
      # Then: falseを返す（アプリ側でexpires_atを比較）
      it 'TTL期限切れ後（DynamoDB遅延削除未完了）の場合、falseを返すこと' do
        create(:rate_limit, identifier: ip_identifier, expires_at: current_time - 1)
        expect(described_class.limited?(ip: ip, nickname: nickname)).to be false
      end
    end

    context 'フェイルオープン (Resilience)' do
      # Given: DynamoDB接続エラーが発生
      # When: limited?を呼び出す
      # Then: 例外をrescueしてfalseを返す（投稿を許可）
      # 注意: DynamoDB接続エラーはAWS SDK側の例外として発生する
      it 'DynamoDB接続エラー時、falseを返すこと' do
        allow(RateLimit).to receive(:find).and_raise(Aws::DynamoDB::Errors::ServiceError.new(nil,
                                                                                             'Service unavailable'))
        expect(Rails.logger).to receive(:error).with(/RateLimiterService.*DynamoDB error/)
        expect(described_class.limited?(ip: ip, nickname: nickname)).to be false
      end

      # Given: DynamoDB RecordNotFound
      # When: limited?を呼び出す
      # Then: falseを返す（レコード未存在）
      it 'レコードが存在しない場合、falseを返すこと' do
        expect(described_class.limited?(ip: '127.0.0.999', nickname: '存在しないユーザー')).to be false
      end

      # Given: 予期しないエラー（StandardError）が発生
      # When: limited?を呼び出す
      # Then: 例外をrescueしてfalseを返す（投稿を許可）
      it '予期しないエラー時もfalseを返すこと（フェイルオープン）' do
        allow(RateLimit).to receive(:find).and_raise(StandardError, 'Unexpected error')
        expect(Rails.logger).to receive(:error).with(/RateLimiterService/)
        expect(described_class.limited?(ip: ip, nickname: nickname)).to be false
      end
    end
  end

  # 何を検証するか: 制限設定の正常系
  describe '.set_limit!' do
    let(:ip) { '192.168.1.1' }
    let(:nickname) { '太郎' }
    let(:ip_identifier) { RateLimit.generate_ip_identifier(ip) }
    let(:nickname_identifier) { RateLimit.generate_nickname_identifier(nickname) }

    context '正常系' do
      # Given: IP・ニックネームともに制限なし
      # When: set_limit!を呼び出す
      # Then: IPとニックネームの2レコードが作成される
      it 'IPとニックネームの2レコードが作成されること' do
        expect do
          described_class.set_limit!(ip: ip, nickname: nickname)
        end.to change(RateLimit, :count).by(2)

        expect(RateLimit.find(ip_identifier)).to be_present
        expect(RateLimit.find(nickname_identifier)).to be_present
      end

      # Given: IP・ニックネームともに制限なし
      # When: set_limit!を呼び出す
      # Then: expires_atが現在時刻+300秒に設定される（Integer型）
      it 'expires_atが現在時刻+300秒のInteger型で設定されること' do
        current_time = Time.now.to_i
        described_class.set_limit!(ip: ip, nickname: nickname)

        ip_limit = RateLimit.find(ip_identifier)
        nickname_limit = RateLimit.find(nickname_identifier)

        # Integer型であることを検証（String型の".to_s"ではないこと）
        expect(ip_limit.expires_at).to be_a(Integer)
        expect(ip_limit.expires_at).to be_within(1).of(current_time + 300)
        expect(nickname_limit.expires_at).to be_a(Integer)
        expect(nickname_limit.expires_at).to be_within(1).of(current_time + 300)
      end

      # Given: IPが既に制限中（同一IPで2回目のset_limit!）
      # When: set_limit!を呼び出す
      # Then: IPレコードのexpires_atが更新される（上書き）
      it '既に制限中のIPのexpires_atが更新されること' do
        old_time = Time.now.to_i + 100
        create(:rate_limit, identifier: ip_identifier, expires_at: old_time)

        described_class.set_limit!(ip: ip, nickname: nickname)

        ip_limit = RateLimit.find(ip_identifier)
        expect(ip_limit.expires_at).to be > old_time
      end
    end

    context '異常系' do
      # Given: DynamoDB接続エラー（IP制限設定時）
      # When: set_limit!を呼び出す
      # Then: 例外をキャッチしてニックネーム制限を試行する（フェイルオープン）
      it 'DynamoDB接続エラー時も、他方の制限設定を試行すること' do
        allow(RateLimit).to receive(:set_limit).with(
          instance_of(String), seconds: described_class::LIMIT_DURATION
        ).and_call_original
        # 1回目（IP）はエラー、2回目（ニックネーム）は成功
        allow(RateLimit).to receive(:set_limit).with(
          'ip_192.168.1.1', seconds: described_class::LIMIT_DURATION
        ).and_raise(Aws::DynamoDB::Errors::ServiceError.new(nil, 'Service unavailable'))
        allow(Rails.logger).to receive(:error).with(/\[RateLimiterService\] Failed to set IP limit:/)

        expect do
          described_class.set_limit!(ip: '192.168.1.1', nickname: '太郎')
        end.not_to raise_error
      end
    end
  end

  # 何を検証するか: limited?とset_limit!の統合テスト
  describe '統合テスト' do
    let(:ip) { '192.168.1.1' }
    let(:nickname) { '太郎' }

    # Given: 初回投稿
    # When: set_limit!→limited?
    # Then: trueを返す（制限中）
    it 'set_limit!後にlimited?がtrueを返すこと' do
      described_class.set_limit!(ip: ip, nickname: nickname)
      expect(described_class.limited?(ip: ip, nickname: nickname)).to be true
    end

    # Given: set_limit!でIPのみ制限
    # When: 異なるIPだが同じニックネームでlimited?を呼ぶ
    # Then: trueを返す（ニックネーム制限がOR条件で効く）
    it 'set_limit!後に異なるIPでも同じニックネームならtrueを返すこと' do
      described_class.set_limit!(ip: ip, nickname: nickname)
      expect(described_class.limited?(ip: '10.0.0.1', nickname: nickname)).to be true
    end
  end
end
