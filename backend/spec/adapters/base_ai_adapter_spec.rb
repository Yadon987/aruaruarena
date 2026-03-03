# frozen_string_literal: true

require 'rails_helper'
require 'support/test_adapter'

RSpec.describe BaseAiAdapter do
  # 各テスト前にadapterをリセットしてstate leakを防止
  let(:adapter) { TestAdapter.new }
  let(:base_scores) do
    { empathy: 15, humor: 15, brevity: 15, originality: 15, expression: 15 }
  end

  before do
    # 各テストの前にmock_response_procをクリア
    adapter.mock_response_proc = nil
    # リトライ時のsleepをモック（テスト高速化）
    allow(adapter).to receive(:retry_sleep)
  end

  describe '定数' do
    it 'MAX_RETRIESが2であること' do
      expect(described_class::MAX_RETRIES).to eq(2)
    end

    it 'BASE_TIMEOUTが20であること' do
      expect(described_class::BASE_TIMEOUT).to eq(20)
    end

    it 'RETRY_DELAYが1.0であること' do
      expect(described_class::RETRY_DELAY).to eq(1.0)
    end
  end

  describe 'JudgmentResult構造体' do
    it 'succeeded属性を持つこと' do
      result = described_class::JudgmentResult.new(succeeded: true)
      expect(result.succeeded).to be true
    end

    it 'error_code属性を持つこと' do
      result = described_class::JudgmentResult.new(error_code: nil)
      expect(result.error_code).to be_nil
    end

    it 'scores属性を持つこと' do
      scores = { empathy: 10 }
      result = described_class::JudgmentResult.new(scores: scores)
      expect(result.scores).to eq(scores)
    end

    it 'comment属性を持つこと' do
      result = described_class::JudgmentResult.new(comment: 'test')
      expect(result.comment).to eq('test')
    end
  end

  describe '#judge' do
    context '入力バリデーション' do
      it 'post_contentがnilの場合はArgumentErrorを発生させること' do
        expect do
          adapter.judge(nil, persona: 'hiroyuki')
        end.to raise_error(ArgumentError, /post_content/)
      end

      it 'post_contentが空文字の場合はArgumentErrorを発生させること' do
        expect do
          adapter.judge('', persona: 'hiroyuki')
        end.to raise_error(ArgumentError, /post_content/)
      end

      it 'post_contentが空白のみの場合はArgumentErrorを発生させること' do
        expect do
          adapter.judge('   ', persona: 'hiroyuki')
        end.to raise_error(ArgumentError, /post_content/)
      end

      it 'post_contentが2文字以下の場合はArgumentErrorを発生させること（境界値）' do
        expect do
          adapter.judge('AB', persona: 'hiroyuki')
        end.to raise_error(ArgumentError, /post_content/)
      end

      it 'post_contentが3文字の場合はバリデーションを通過すること（境界値）' do
        adapter.mock_response = described_class::JudgmentResult.new(
          succeeded: true,
          error_code: nil,
          scores: base_scores,
          comment: 'OK'
        )
        expect do
          adapter.judge('ABC', persona: 'hiroyuki')
        end.not_to raise_error
      end

      it 'post_contentが30文字の場合はバリデーションを通過すること（境界値）' do
        adapter.mock_response = described_class::JudgmentResult.new(
          succeeded: true,
          error_code: nil,
          scores: base_scores,
          comment: 'OK'
        )
        content = 'A' * 30
        expect do
          adapter.judge(content, persona: 'hiroyuki')
        end.not_to raise_error
      end

      it 'post_contentが31文字以上の場合はArgumentErrorを発生させること（境界値）' do
        expect do
          adapter.judge('A' * 31, persona: 'hiroyuki')
        end.to raise_error(ArgumentError, /post_content/)
      end

      it 'post_contentに絵文字を含む場合にgrapheme単位で正しくカウントすること' do
        adapter.mock_response = described_class::JudgmentResult.new(
          succeeded: true,
          error_code: nil,
          scores: base_scores,
          comment: 'OK'
        )
        # '👨‍👩‍👧‍👦' は1つのgraphemeクラスタ
        expect do
          adapter.judge('👨‍👩‍👧‍👦AB', persona: 'hiroyuki')
        end.not_to raise_error
      end

      it 'post_contentに制御文字を含む場合はArgumentErrorを発生させること' do
        expect do
          adapter.judge("ABC\x00", persona: 'hiroyuki')
        end.to raise_error(ArgumentError, /post_content/)
      end

      it 'personaがnilの場合はArgumentErrorを発生させること' do
        expect do
          adapter.judge('テスト投稿', persona: nil)
        end.to raise_error(ArgumentError, /persona/)
      end

      it 'personaが空文字の場合はArgumentErrorを発生させること' do
        expect do
          adapter.judge('テスト投稿', persona: '')
        end.to raise_error(ArgumentError, /persona/)
      end

      it 'personaがhiroyukiの場合は有効であること' do
        adapter.mock_response = described_class::JudgmentResult.new(
          succeeded: true,
          error_code: nil,
          scores: base_scores,
          comment: 'OK'
        )
        expect do
          adapter.judge('テスト投稿', persona: 'hiroyuki')
        end.not_to raise_error
      end

      it 'personaがdewiの場合は有効であること' do
        adapter.mock_response = described_class::JudgmentResult.new(
          succeeded: true,
          error_code: nil,
          scores: base_scores,
          comment: 'OK'
        )
        expect do
          adapter.judge('テスト投稿', persona: 'dewi')
        end.not_to raise_error
      end

      it 'personaがnakaoの場合は有効であること' do
        adapter.mock_response = described_class::JudgmentResult.new(
          succeeded: true,
          error_code: nil,
          scores: base_scores,
          comment: 'OK'
        )
        expect do
          adapter.judge('テスト投稿', persona: 'nakao')
        end.not_to raise_error
      end

      it '不正なpersonaの場合はArgumentErrorを発生させること' do
        expect do
          adapter.judge('テスト投稿', persona: 'invalid')
        end.to raise_error(ArgumentError, /persona/)
      end
    end

    context '正常系' do
      before do
        adapter.mock_response = described_class::JudgmentResult.new(
          succeeded: true,
          error_code: nil,
          scores: base_scores,
          comment: '素晴らしいあるあるです！'
        )
      end

      it '有効な入力でjudgeを実行できること' do
        expect do
          adapter.judge('テスト投稿', persona: 'hiroyuki')
        end.not_to raise_error
      end

      it '成功時にJudgmentResultが返されること' do
        result = adapter.judge('テスト投稿', persona: 'hiroyuki')
        expect(result).to be_a(described_class::JudgmentResult)
      end

      it '成功時にsucceededがtrueであること' do
        result = adapter.judge('テスト投稿', persona: 'hiroyuki')
        expect(result.succeeded).to be true
      end

      it '成功時にスコアとコメントが含まれること' do
        result = adapter.judge('テスト投稿', persona: 'hiroyuki')
        expect(result.scores).to be_a(Hash)
        expect(result.scores.keys).to include(:empathy, :humor, :brevity, :originality, :expression)
        expect(result.comment).to be_a(String)
      end

      it '成功時にバイアスが適用されたスコアが返されること' do
        result = adapter.judge('テスト投稿', persona: 'hiroyuki')
        # base_scoresは全て15で、hiroyukiバイアス（独創性+3、共感度-2）が適用される
        expect(result.scores[:originality]).to eq(18) # 15 + 3
        expect(result.scores[:empathy]).to eq(13) # 15 - 2
      end
    end

    context 'リトライ処理' do
      it 'タイムアウト時に1回リトライすること' do
        adapter.reset_call_count! # 呼び出し回数をリセット
        adapter.mock_response_proc = lambda { |attempt|
          raise Timeout::Error, 'API timeout' if attempt == 1

          described_class::JudgmentResult.new(
            succeeded: true,
            error_code: nil,
            scores: base_scores,
            comment: '成功'
          )
        }

        adapter.judge('テスト投稿', persona: 'hiroyuki')
        expect(adapter.call_count).to eq(2) # 初回 + 1回リトライ
      end

      it 'タイムアウト時にMAX_RETRIES回リトライすること' do
        adapter.reset_call_count!
        adapter.mock_response_proc = lambda { |_|
          raise Timeout::Error, 'API timeout'
        }

        adapter.judge('テスト投稿', persona: 'hiroyuki')
        expect(adapter.call_count).to eq(described_class::MAX_RETRIES + 1) # 初回 + 2回リトライ
      end

      it 'MAX_RETRIES超過で失敗すること' do
        adapter.reset_call_count!
        adapter.mock_response_proc = lambda { |_|
          raise Timeout::Error, 'API timeout'
        }

        result = adapter.judge('テスト投稿', persona: 'hiroyuki')
        expect(result.succeeded).to be false
        expect(result.error_code).to eq('timeout')
      end

      it 'リトライ時に指数バックオフで遅延が増加すること（1秒→2秒）' do
        adapter.reset_call_count!
        adapter.mock_response_proc = lambda { |attempt|
          raise Timeout::Error, 'API timeout' if attempt <= 2

          described_class::JudgmentResult.new(
            succeeded: true,
            error_code: nil,
            scores: base_scores,
            comment: '成功'
          )
        }

        # retry_sleepをモックしてdurationを記録
        sleep_calls = []
        allow(adapter).to receive(:retry_sleep) do |duration|
          sleep_calls << duration
        end

        adapter.judge('テスト投稿', persona: 'hiroyuki')

        expect(sleep_calls).to eq([1.0, 2.0])
      end

      it 'invalid_response時もMAX_RETRIESまで再試行すること' do
        adapter.reset_call_count!
        adapter.mock_response_proc = lambda { |attempt|
          if attempt <= 2
            described_class::JudgmentResult.new(
              succeeded: false,
              error_code: 'invalid_response',
              scores: nil,
              comment: nil
            )
          else
            described_class::JudgmentResult.new(
              succeeded: true,
              error_code: nil,
              scores: base_scores,
              comment: '成功'
            )
          end
        }

        result = adapter.judge('テスト投稿', persona: 'hiroyuki')

        expect(adapter.call_count).to eq(3)
        expect(result.succeeded).to be(true)
      end
    end

    context 'ペルソナバイアス適用' do
      before do
        adapter.mock_response = described_class::JudgmentResult.new(
          succeeded: true,
          error_code: nil,
          scores: base_scores,
          comment: 'テストコメント'
        )
      end

      context 'hiroyukiの場合' do
        it 'ひろゆき風のバイアスが適用されること' do
          result = adapter.judge('テスト投稿', persona: 'hiroyuki')
          expect(result.scores[:originality]).to eq(18) # 15 + 3
          expect(result.scores[:empathy]).to eq(13) # 15 - 2
        end

        it 'ひろゆき風のバイアスで0-20の範囲内に収まること' do
          edge_scores = { empathy: 1, humor: 15, brevity: 15, originality: 19, expression: 15 }
          adapter.mock_response = described_class::JudgmentResult.new(
            succeeded: true,
            error_code: nil,
            scores: edge_scores,
            comment: 'テストコメント'
          )

          result = adapter.judge('テスト投稿', persona: 'hiroyuki')
          expect(result.scores[:originality]).to eq(20) # 最大値クリップ
          expect(result.scores[:empathy]).to eq(0) # 最小値クリップ
        end
      end

      context 'dewiの場合' do
        it 'デヴィ婦人風のバイアスが適用されること' do
          result = adapter.judge('テスト投稿', persona: 'dewi')
          expect(result.scores[:expression]).to eq(18) # 15 + 3
          expect(result.scores[:humor]).to eq(17) # 15 + 2
        end

        it 'デヴィ婦人風のバイアスで0-20の範囲内に収まること' do
          edge_scores = { empathy: 15, humor: 19, brevity: 15, originality: 15, expression: 18 }
          adapter.mock_response = described_class::JudgmentResult.new(
            succeeded: true,
            error_code: nil,
            scores: edge_scores,
            comment: 'テストコメント'
          )

          result = adapter.judge('テスト投稿', persona: 'dewi')
          expect(result.scores[:expression]).to eq(20) # 最大値クリップ
          expect(result.scores[:humor]).to eq(20) # 最大値クリップ
        end
      end

      context 'nakaoの場合' do
        it '中尾彬風のバイアスが適用されること' do
          result = adapter.judge('テスト投稿', persona: 'nakao')
          expect(result.scores[:humor]).to eq(18) # 15 + 3
          expect(result.scores[:empathy]).to eq(17) # 15 + 2
        end

        it '中尾彬風のバイアスで0-20の範囲内に収まること' do
          edge_scores = { empathy: 19, humor: 18, brevity: 15, originality: 15, expression: 15 }
          adapter.mock_response = described_class::JudgmentResult.new(
            succeeded: true,
            error_code: nil,
            scores: edge_scores,
            comment: 'テストコメント'
          )

          result = adapter.judge('テスト投稿', persona: 'nakao')
          expect(result.scores[:humor]).to eq(20) # 最大値クリップ
          expect(result.scores[:empathy]).to eq(20) # 最大値クリップ
        end
      end
    end

    context 'エラーハンドリング' do
      it 'Timeout::Errorをtimeoutエラーコードに変換すること' do
        adapter.mock_response_proc = ->(_) { raise Timeout::Error, 'timeout' }
        result = adapter.judge('テスト投稿', persona: 'hiroyuki')

        expect(result.succeeded).to be false
        expect(result.error_code).to eq('timeout')
      end

      it 'Faraday::TimeoutErrorをtimeoutエラーコードに変換すること' do
        adapter.mock_response_proc = ->(_) { raise Faraday::TimeoutError, 'timeout' }
        result = adapter.judge('テスト投稿', persona: 'hiroyuki')

        expect(result.succeeded).to be false
        expect(result.error_code).to eq('timeout')
      end

      it 'Faraday::ConnectionFailedをconnection_failedエラーコードに変換すること' do
        adapter.mock_response_proc = ->(_) { raise Faraday::ConnectionFailed, 'connection failed' }
        result = adapter.judge('テスト投稿', persona: 'hiroyuki')

        expect(result.succeeded).to be false
        expect(result.error_code).to eq('connection_failed')
      end

      it 'Faraday::ClientErrorをprovider_errorエラーコードに変換すること' do
        adapter.mock_response_proc = ->(_) { raise Faraday::ClientError, 'client error' }
        result = adapter.judge('テスト投稿', persona: 'hiroyuki')

        expect(result.succeeded).to be false
        expect(result.error_code).to eq('provider_error')
      end

      it 'Faraday::ServerErrorをprovider_errorエラーコードに変換すること' do
        adapter.mock_response_proc = ->(_) { raise Faraday::ServerError, 'server error' }
        result = adapter.judge('テスト投稿', persona: 'hiroyuki')

        expect(result.succeeded).to be false
        expect(result.error_code).to eq('provider_error')
      end

      it 'JSON::ParserErrorをinvalid_responseエラーコードに変換すること' do
        adapter.mock_response_proc = ->(_) { raise JSON::ParserError, 'parse error' }
        result = adapter.judge('テスト投稿', persona: 'hiroyuki')

        expect(result.succeeded).to be false
        expect(result.error_code).to eq('invalid_response')
      end

      it 'スコアが範囲外の場合はinvalid_responseエラーコードを返すこと' do
        adapter.mock_response_proc = lambda { |_|
          { 'scores' => { empathy: 25, humor: 15, brevity: 15, originality: 15, expression: 15 }, 'comment' => 'test' }
        }
        result = adapter.judge('テスト投稿', persona: 'hiroyuki')

        expect(result.succeeded).to be false
        expect(result.error_code).to eq('invalid_response')
      end

      it 'commentが空文字列の場合はinvalid_responseエラーコードを返すこと' do
        adapter.mock_response_proc = lambda { |_|
          { 'scores' => base_scores, 'comment' => '' }
        }
        result = adapter.judge('テスト投稿', persona: 'hiroyuki')

        expect(result.succeeded).to be false
        expect(result.error_code).to eq('invalid_response')
      end

      it '未知のエラーをunknown_errorエラーコードに変換すること' do
        adapter.mock_response_proc = ->(_) { raise StandardError, 'unknown error' }
        result = adapter.judge('テスト投稿', persona: 'hiroyuki')

        expect(result.succeeded).to be false
        expect(result.error_code).to eq('unknown_error')
      end
    end

    context 'スコア範囲チェック' do
      it 'スコアが-1の場合はinvalid_responseエラーコードを返すこと（境界値）' do
        adapter.mock_response_proc = lambda { |_|
          { 'scores' => { empathy: -1, humor: 15, brevity: 15, originality: 15, expression: 15 }, 'comment' => 'test' }
        }
        result = adapter.judge('テスト投稿', persona: 'hiroyuki')
        expect(result.succeeded).to be false
        expect(result.error_code).to eq('invalid_response')
      end

      it 'スコアが0の場合は有効であること（境界値）' do
        adapter.mock_response_proc = lambda { |_|
          { 'scores' => { empathy: 0, humor: 15, brevity: 15, originality: 15, expression: 15 }, 'comment' => 'test' }
        }
        result = adapter.judge('テスト投稿', persona: 'hiroyuki')
        expect(result.succeeded).to be true
      end

      it 'スコアが20の場合は有効であること（境界値）' do
        adapter.mock_response_proc = lambda { |_|
          { 'scores' => { empathy: 20, humor: 15, brevity: 15, originality: 15, expression: 15 }, 'comment' => 'test' }
        }
        result = adapter.judge('テスト投稿', persona: 'hiroyuki')
        expect(result.succeeded).to be true
      end

      it 'スコアが21の場合はinvalid_responseエラーコードを返すこと（境界値）' do
        adapter.mock_response_proc = lambda { |_|
          { 'scores' => { empathy: 21, humor: 15, brevity: 15, originality: 15, expression: 15 }, 'comment' => 'test' }
        }
        result = adapter.judge('テスト投稿', persona: 'hiroyuki')
        expect(result.succeeded).to be false
        expect(result.error_code).to eq('invalid_response')
      end

      it 'スコアが浮動小数点数の場合はinvalid_responseエラーコードを返すこと' do
        adapter.mock_response_proc = lambda { |_|
          { 'scores' => { empathy: 15.5, humor: 15, brevity: 15, originality: 15, expression: 15 },
            'comment' => 'test' }
        }
        result = adapter.judge('テスト投稿', persona: 'hiroyuki')
        expect(result.succeeded).to be false
        expect(result.error_code).to eq('invalid_response')
      end

      it 'スコアが文字列の数字の場合はinvalid_responseエラーコードを返すこと' do
        adapter.mock_response_proc = lambda { |_|
          { 'scores' => { empathy: '15', humor: 15, brevity: 15, originality: 15, expression: 15 },
            'comment' => 'test' }
        }
        result = adapter.judge('テスト投稿', persona: 'hiroyuki')
        expect(result.succeeded).to be false
        expect(result.error_code).to eq('invalid_response')
      end
    end

    context 'レスポンス形式のバリデーション' do
      it 'scoresがnilの場合は有効であること（空スコア許容）' do
        adapter.mock_response_proc = lambda { |_|
          { 'scores' => nil, 'comment' => 'test' }
        }
        result = adapter.judge('テスト投稿', persona: 'hiroyuki')
        expect(result.succeeded).to be true
      end

      it 'scoresが空ハッシュの場合はinvalid_responseエラーコードを返すこと（必須キー欠損）' do
        adapter.mock_response_proc = lambda { |_|
          { 'scores' => {}, 'comment' => 'test' }
        }
        result = adapter.judge('テスト投稿', persona: 'hiroyuki')
        expect(result.succeeded).to be false
        expect(result.error_code).to eq('invalid_response')
      end

      it 'commentがnilの場合はinvalid_responseエラーコードを返すこと' do
        adapter.mock_response_proc = lambda { |_|
          { 'scores' => base_scores, 'comment' => nil }
        }
        result = adapter.judge('テスト投稿', persona: 'hiroyuki')
        expect(result.succeeded).to be false
        expect(result.error_code).to eq('invalid_response')
      end

      it 'commentが空白のみの場合はinvalid_responseエラーコードを返すこと' do
        adapter.mock_response_proc = lambda { |_|
          { 'scores' => base_scores, 'comment' => '   ' }
        }
        result = adapter.judge('テスト投稿', persona: 'hiroyuki')
        expect(result.succeeded).to be false
        expect(result.error_code).to eq('invalid_response')
      end

      it 'commentが全角スペースのみの場合は有効であること（stripは全角を削除しない）' do
        adapter.mock_response_proc = lambda { |_|
          { 'scores' => base_scores, 'comment' => '　' }
        }
        result = adapter.judge('テスト投稿', persona: 'hiroyuki')
        expect(result.succeeded).to be true
      end

      it 'スコアフィールドが一部欠落している場合はinvalid_responseエラーコードを返すこと' do
        adapter.mock_response_proc = lambda { |_|
          { 'scores' => { humor: 15, brevity: 15, originality: 15, expression: 15 }, 'comment' => 'test' }
        }
        result = adapter.judge('テスト投稿', persona: 'hiroyuki')
        expect(result.succeeded).to be false
        expect(result.error_code).to eq('invalid_response')
      end

      it 'スコアフィールドに余分なキーが含まれる場合はinvalid_responseエラーコードを返すこと' do
        adapter.mock_response_proc = lambda { |_|
          { 'scores' => { empathy: 15, humor: 15, brevity: 15, originality: 15, expression: 15, extra_score: 10 },
            'comment' => 'test' }
        }
        result = adapter.judge('テスト投稿', persona: 'hiroyuki')
        expect(result.succeeded).to be false
        expect(result.error_code).to eq('invalid_response')
      end
    end

    context 'タイムアウト境界値' do
      it 'MAX_RETRIES回のリトライ後に成功すること' do
        adapter.reset_call_count!
        adapter.mock_response_proc = lambda { |attempt|
          raise Timeout::Error, 'API timeout' if attempt <= 2

          described_class::JudgmentResult.new(
            succeeded: true,
            error_code: nil,
            scores: base_scores,
            comment: '成功'
          )
        }

        result = adapter.judge('テスト投稿', persona: 'hiroyuki')
        expect(result.succeeded).to be true
        expect(adapter.call_count).to eq(3) # 初回 + 2回リトライ
      end

      it 'MAX_RETRIES超過で失敗すること' do
        adapter.reset_call_count!
        adapter.mock_response_proc = lambda { |attempt|
          raise Timeout::Error, 'API timeout' if attempt <= 3 # 初回 + 3回試行

          described_class::JudgmentResult.new(
            succeeded: true,
            error_code: nil,
            scores: base_scores,
            comment: '成功'
          )
        }

        result = adapter.judge('テスト投稿', persona: 'hiroyuki')
        expect(result.succeeded).to be false
        expect(result.error_code).to eq('timeout')
        expect(adapter.call_count).to eq(3) # 初回 + 2回リトライ（MAX_RETRIES=2）
      end
    end

    context 'スレッドセーフティ' do
      it '同じアダプターインスタンスを共有する場合にスレッドセーフであること' do
        adapter.mock_response = described_class::JudgmentResult.new(
          succeeded: true,
          error_code: nil,
          scores: base_scores,
          comment: '成功'
        )

        threads = 10.times.map do
          Thread.new { adapter.judge('テスト投稿', persona: 'hiroyuki') }
        end

        results = threads.map(&:value)
        expect(results.size).to eq(10)
        expect(results.all?(&:succeeded)).to be true
      end
    end

    context 'ログ出力' do
      before do
        adapter.mock_response = described_class::JudgmentResult.new(
          succeeded: true,
          error_code: nil,
          scores: base_scores,
          comment: '成功'
        )
      end

      it '成功時にINFOレベルでログが出力されること' do
        expect(Rails.logger).to receive(:info).with(/審査成功/)
        adapter.judge('テスト投稿', persona: 'hiroyuki')
      end

      it 'リトライ時にWARNレベルでログが出力されること' do
        adapter.mock_response_proc = lambda { |attempt|
          raise Timeout::Error, 'API timeout' if attempt == 1

          described_class::JudgmentResult.new(
            succeeded: true,
            error_code: nil,
            scores: base_scores,
            comment: '成功'
          )
        }

        expect(Rails.logger).to receive(:warn).with(/リトライ/)
        adapter.judge('テスト投稿', persona: 'hiroyuki')
      end

      it '失敗時にERRORレベルでログが出力されること' do
        adapter.mock_response_proc = ->(_) { raise Timeout::Error, 'timeout' }

        expect(Rails.logger).to receive(:error).with(/審査失敗/).at_least(:once)
        adapter.judge('テスト投稿', persona: 'hiroyuki')
      end
    end
  end

  describe '抽象メソッド' do
    it 'clientメソッドがNotImplementedErrorを発生させること' do
      adapter = described_class.new
      expect do
        adapter.send(:client)
      end.to raise_error(NotImplementedError, /must be implemented/)
    end

    it 'build_requestメソッドがNotImplementedErrorを発生させること' do
      adapter = described_class.new
      expect do
        adapter.send(:build_request, 'test', 'hiroyuki')
      end.to raise_error(NotImplementedError, /must be implemented/)
    end

    it 'parse_responseメソッドがNotImplementedErrorを発生させること' do
      adapter = described_class.new
      expect do
        adapter.send(:parse_response, {})
      end.to raise_error(NotImplementedError, /must be implemented/)
    end

    it 'api_keyメソッドがNotImplementedErrorを発生させること' do
      adapter = described_class.new
      expect do
        adapter.send(:api_key)
      end.to raise_error(NotImplementedError, /must be implemented/)
    end
  end

  describe '並行処理' do
    it '複数スレッドから同時に呼び出された場合に正しく動作すること' do
      adapter.mock_response = described_class::JudgmentResult.new(
        succeeded: true,
        error_code: nil,
        scores: base_scores,
        comment: '成功'
      )

      threads = 10.times.map do
        Thread.new do
          adapter.judge('テスト投稿', persona: 'hiroyuki')
        end
      end

      results = threads.map(&:value)

      expect(results.size).to eq(10)
      expect(results.all? { |r| r.is_a?(described_class::JudgmentResult) }).to be true
      expect(results.all?(&:succeeded)).to be true
    end

    it '共有状態の変更が他のスレッドに影響しないこと' do
      adapter.mock_response = described_class::JudgmentResult.new(
        succeeded: true,
        error_code: nil,
        scores: base_scores,
        comment: '成功'
      )

      threads = 5.times.map do |_i|
        Thread.new do
          3.times do
            result = adapter.judge('テスト投稿', persona: 'hiroyuki')
            expect(result.scores[:originality]).to eq(18) # hiroyukiバイアス適用後
          end
        end
      end

      threads.each(&:join)
    end
  end
end
