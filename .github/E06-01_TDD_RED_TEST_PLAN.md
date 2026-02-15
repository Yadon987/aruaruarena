# E06-01: TDD Redテスト作成プラン

## 概要

Issue #31の受け入れ基準をすべてカバーするTDD Redフェーズ用テストコードを作成します。

**コミットメッセージ**: `test: E06-01 BaseAiAdapterのREDテストを作成 #31`

---

## 1. テスト構造の設計

### describe/contextの階層構造

```
RSpec.describe BaseAiAdapter do
  describe '定数' do
    # MAX_RETRIES, BASE_TIMEOUT, RETRY_DELAYの検証
  end

  describe 'JudgmentResult構造体' do
    # 構造体の属性と初期値の検証
  end

  describe '#judge' do
    context '入力バリデーション' do
      # post_contentがnil/空文字/空白のみ/文字数境界値の場合
      # personaがnil/空文字/不正値/有効値の場合
    end

    context '正常系' do
      # AI APIが正常にレスポンスを返す場合
      # ペルソナバイアスが適用される場合
    end

    context 'リトライ処理' do
      # タイムアウト時にリトライが行われる場合
      # MAX_RETRIES回超過で失敗する場合
      # 指数バックオフで遅延が増加する場合
    end

    context 'ペルソナバイアス適用' do
      # ひろゆき風: 独創性+3、共感度-2
      # デヴィ婦人風: 表現力+3、面白さ+2
      # 中尾彬風: 面白さ+3、共感度+2
      # バイアス適用後も0-20の範囲内に収まる
    end

    context 'エラーハンドリング' do
      # 各種例外→エラーコードのマッピング
      # スコア範囲外エラー
      # コメント不正エラー
    end

    context 'ログ出力' do
      # INFO/WARN/ERRORログの出力確認
    end
  end

  describe '抽象メソッド' do
    # client, build_request, parse_response, api_keyがNotImplementedErrorを発生させる
  end

  describe '並行処理' do
    # Thread-safeであることの確認
  end
end
```

### テストケース一覧（53件）

| ID | テストケース | AC対応 |
|----|-------------|--------|
| T01 | MAX_RETRIESが3であること | - |
| T02 | BASE_TIMEOUTが30であること | - |
| T03 | RETRY_DELAYが1.0であること | - |
| T04 | JudgmentResultがsucceededを持つこと | - |
| T05 | JudgmentResultがerror_codeを持つこと | - |
| T06 | JudgmentResultがscoresを持つこと | - |
| T07 | JudgmentResultがcommentを持つこと | - |
| T08 | post_contentがnilの場合はArgumentErrorを発生させること | 異常系 |
| T09 | post_contentが空文字の場合はArgumentErrorを発生させること | 異常系 |
| T10 | post_contentが空白のみの場合はArgumentErrorを発生させること | 異常系 |
| T11 | post_contentが2文字以下の場合はArgumentErrorを発生させること（境界値） | 異常系 |
| T12 | post_contentが3文字の場合はバリデーションを通過すること（境界値） | 正常系 |
| T13 | post_contentが30文字の場合はバリデーションを通過すること（境界値） | 正常系 |
| T14 | post_contentが31文字以上の場合はArgumentErrorを発生させること（境界値） | 異常系 |
| T15 | post_contentに絵文字を含む場合にgrapheme単位で正しくカウントすること | 正常系 |
| T16 | post_contentに制御文字を含む場合はArgumentErrorを発生させること | 異常系 |
| T17 | personaがnilの場合はArgumentErrorを発生させること | 異常系 |
| T18 | personaが空文字の場合はArgumentErrorを発生させること | 異常系 |
| T19 | personaがhiroyukiの場合は有効であること | 正常系 |
| T20 | personaがdewiの場合は有効であること | 正常系 |
| T21 | personaがnakaoの場合は有効であること | 正常系 |
| T22 | 不正なpersonaの場合はArgumentErrorを発生させること | 異常系 |
| T23 | 有効な入力でjudgeを実行できること | 正常系 |
| T24 | 成功時にJudgmentResultが返されること | 正常系 |
| T25 | 成功時にsucceededがtrueであること | 正常系 |
| T26 | 成功時にスコアとコメントが含まれること | 正常系 |
| T27 | タイムアウト時に1回リトライすること | 異常系 |
| T28 | タイムアウト時にMAX_RETRIES回リトライすること | 異常系 |
| T29 | MAX_RETRIES超過で失敗すること | 異常系 |
| T30 | リトライ時に指数バックオフで遅延が増加すること（1秒→2秒→4秒） | 異常系 |
| T31 | ひろゆき風のバイアスが適用されること | 境界値 |
| T32 | ひろゆき風のバイアスで0-20の範囲内に収まること | 境界値 |
| T33 | デヴィ婦人風のバイアスが適用されること | 境界値 |
| T34 | デヴィ婦人風のバイアスで0-20の範囲内に収まること | 境界値 |
| T35 | 中尾彬風のバイアスが適用されること | 境界値 |
| T36 | 中尾彬風のバイアスで0-20の範囲内に収まること | 境界値 |
| T37 | Timeout::Errorをtimeoutエラーコードに変換すること | - |
| T38 | Faraday::TimeoutErrorをtimeoutエラーコードに変換すること | - |
| T39 | Faraday::ConnectionFailedをconnection_failedエラーコードに変換すること | - |
| T40 | Faraday::ClientErrorをprovider_errorエラーコードに変換すること | - |
| T41 | Faraday::ServerErrorをprovider_errorエラーコードに変換すること | - |
| T42 | JSON::ParserErrorをinvalid_responseエラーコードに変換すること | - |
| T43 | スコアが範囲外の場合はinvalid_responseエラーコードを返すこと | - |
| T44 | commentが空文字列の場合はinvalid_responseエラーコードを返すこと | - |
| T45 | 未知のエラーをunknown_errorエラーコードに変換すること | - |
| T46 | 成功時にINFOレベルでログが出力されること | - |
| T47 | リトライ時にWARNレベルでログが出力されること | - |
| T48 | 失敗時にERRORレベルでログが出力されること | - |
| T49 | clientメソッドがNotImplementedErrorを発生させること | - |
| T50 | build_requestメソッドがNotImplementedErrorを発生させること | - |
| T51 | parse_responseメソッドがNotImplementedErrorを発生させること | - |
| T52 | api_keyメソッドがNotImplementedErrorを発生させること | - |
| T53 | 複数スレッドから同時に呼び出された場合に正しく動作すること | - |

---

## 2. TestAdapterモックの設計

`spec/support/test_adapter.rb`:

```ruby
# frozen_string_literal: true

# テスト用モッククラス
# BaseAiAdapterの抽象メソッドを実装し、テスト用の振る舞いを提供する
class TestAdapter < BaseAiAdapter
  attr_accessor :mock_client, :mock_response, :mock_response_proc

  def initialize
    @mock_client = instance_double('Faraday::Connection')
    @call_count = 0
    @mutex = Mutex.new
  end

  def client
    @mock_client
  end

  def build_request(post_content, persona)
    {
      content: post_content,
      persona: persona,
      timestamp: Time.now.to_i
    }
  end

  def parse_response(response)
    @mutex.synchronize do
      @call_count += 1
    end

    # プロックが設定されている場合はそれを使用（リトライテスト用）
    if @mock_response_proc
      result = @mock_response_proc.call(@call_count)
      return result if result.is_a?(JudgmentResult)
      # スコア範囲チェック
      return create_error_result('invalid_response') if invalid_scores?(result)
      return create_error_result('invalid_response') if empty_comment?(result)
      return result
    end

    # 通常のモックレスポンス
    return @mock_response if @mock_response

    # デフォルトの成功レスポンス
    BaseAiAdapter::JudgmentResult.new(
      succeeded: true,
      error_code: nil,
      scores: {
        empathy: 15,
        humor: 15,
        brevity: 15,
        originality: 15,
        expression: 15
      },
      comment: 'テストコメント'
    )
  end

  def api_key
    'test_api_key_for_testing'
  end

  def reset_call_count!
    @mutex.synchronize do
      @call_count = 0
    end
  end

  def call_count
    @mutex.synchronize do
      @call_count
    end
  end

  private

  def create_error_result(error_code)
    BaseAiAdapter::JudgmentResult.new(
      succeeded: false,
      error_code: error_code,
      scores: nil,
      comment: nil
    )
  end

  def invalid_scores?(response)
    scores = response.dig('scores') || response.dig(:scores)
    return true unless scores

    scores.values.any? { |v| v.to_i < 0 || v.to_i > 20 }
  end

  def empty_comment?(response)
    comment = response.dig('comment') || response.dig(:comment)
    comment.nil? || comment.to_s.empty?
  end
end
```

---

## 3. テストコード（完全版）

```ruby
# frozen_string_literal: true

require 'rails_helper'
require 'test_adapter'

RSpec.describe BaseAiAdapter do
  let(:adapter) { TestAdapter.new }
  let(:base_scores) do
    { empathy: 15, humor: 15, brevity: 15, originality: 15, expression: 15 }
  end

  describe '定数' do
    it 'MAX_RETRIESが3であること' do
      expect(described_class::MAX_RETRIES).to eq(3)
    end

    it 'BASE_TIMEOUTが30であること' do
      expect(described_class::BASE_TIMEOUT).to eq(30)
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
        expect {
          adapter.judge(nil, persona: 'hiroyuki')
        }.to raise_error(ArgumentError, /post_content/)
      end

      it 'post_contentが空文字の場合はArgumentErrorを発生させること' do
        expect {
          adapter.judge('', persona: 'hiroyuki')
        }.to raise_error(ArgumentError, /post_content/)
      end

      it 'post_contentが空白のみの場合はArgumentErrorを発生させること' do
        expect {
          adapter.judge('   ', persona: 'hiroyuki')
        }.to raise_error(ArgumentError, /post_content/)
      end

      it 'post_contentが2文字以下の場合はArgumentErrorを発生させること（境界値）' do
        expect {
          adapter.judge('AB', persona: 'hiroyuki')
        }.to raise_error(ArgumentError, /post_content/)
      end

      it 'post_contentが3文字の場合はバリデーションを通過すること（境界値）' do
        adapter.mock_response = described_class::JudgmentResult.new(
          succeeded: true,
          error_code: nil,
          scores: base_scores,
          comment: 'OK'
        )
        expect {
          adapter.judge('ABC', persona: 'hiroyuki')
        }.not_to raise_error
      end

      it 'post_contentが30文字の場合はバリデーションを通過すること（境界値）' do
        adapter.mock_response = described_class::JudgmentResult.new(
          succeeded: true,
          error_code: nil,
          scores: base_scores,
          comment: 'OK'
        )
        content = 'A' * 30
        expect {
          adapter.judge(content, persona: 'hiroyuki')
        }.not_to raise_error
      end

      it 'post_contentが31文字以上の場合はArgumentErrorを発生させること（境界値）' do
        expect {
          adapter.judge('A' * 31, persona: 'hiroyuki')
        }.to raise_error(ArgumentError, /post_content/)
      end

      it 'post_contentに絵文字を含む場合にgrapheme単位で正しくカウントすること' do
        adapter.mock_response = described_class::JudgmentResult.new(
          succeeded: true,
          error_code: nil,
          scores: base_scores,
          comment: 'OK'
        )
        # '👨‍👩‍👧‍👦' は1つのgraphemeクラスタ
        expect {
          adapter.judge('👨‍👩‍👧‍👦AB', persona: 'hiroyuki')
        }.not_to raise_error
      end

      it 'post_contentに制御文字を含む場合はArgumentErrorを発生させること' do
        expect {
          adapter.judge("ABC\x00", persona: 'hiroyuki')
        }.to raise_error(ArgumentError, /post_content/)
      end

      it 'personaがnilの場合はArgumentErrorを発生させること' do
        expect {
          adapter.judge('テスト投稿', persona: nil)
        }.to raise_error(ArgumentError, /persona/)
      end

      it 'personaが空文字の場合はArgumentErrorを発生させること' do
        expect {
          adapter.judge('テスト投稿', persona: '')
        }.to raise_error(ArgumentError, /persona/)
      end

      it 'personaがhiroyukiの場合は有効であること' do
        adapter.mock_response = described_class::JudgmentResult.new(
          succeeded: true,
          error_code: nil,
          scores: base_scores,
          comment: 'OK'
        )
        expect {
          adapter.judge('テスト投稿', persona: 'hiroyuki')
        }.not_to raise_error
      end

      it 'personaがdewiの場合は有効であること' do
        adapter.mock_response = described_class::JudgmentResult.new(
          succeeded: true,
          error_code: nil,
          scores: base_scores,
          comment: 'OK'
        )
        expect {
          adapter.judge('テスト投稿', persona: 'dewi')
        }.not_to raise_error
      end

      it 'personaがnakaoの場合は有効であること' do
        adapter.mock_response = described_class::JudgmentResult.new(
          succeeded: true,
          error_code: nil,
          scores: base_scores,
          comment: 'OK'
        )
        expect {
          adapter.judge('テスト投稿', persona: 'nakao')
        }.not_to raise_error
      end

      it '不正なpersonaの場合はArgumentErrorを発生させること' do
        expect {
          adapter.judge('テスト投稿', persona: 'invalid')
        }.to raise_error(ArgumentError, /persona/)
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
        expect {
          adapter.judge('テスト投稿', persona: 'hiroyuki')
        }.not_to raise_error
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
    end

    context 'リトライ処理' do
      it 'タイムアウト時に1回リトライすること' do
        adapter.mock_response_proc = ->(attempt) {
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
        adapter.mock_response_proc = ->(_) {
          raise Timeout::Error, 'API timeout'
        }

        adapter.judge('テスト投稿', persona: 'hiroyuki')
        expect(adapter.call_count).to eq(described_class::MAX_RETRIES + 1) # 初回 + 3回リトライ
      end

      it 'MAX_RETRIES超過で失敗すること' do
        adapter.mock_response_proc = ->(_) {
          raise Timeout::Error, 'API timeout'
        }

        result = adapter.judge('テスト投稿', persona: 'hiroyuki')
        expect(result.succeeded).to be false
        expect(result.error_code).to eq('timeout')
      end

      it 'リトライ時に指数バックオフで遅延が増加すること（1秒→2秒→4秒）' do
        adapter.mock_response_proc = ->(attempt) {
          raise Timeout::Error, 'API timeout' if attempt <= 3
          described_class::JudgmentResult.new(
            succeeded: true,
            error_code: nil,
            scores: base_scores,
            comment: '成功'
          )
        }

        sleep_durations = []
        allow(Kernel).to receive(:sleep) { |duration| sleep_durations << duration }

        adapter.judge('テスト投稿', persona: 'hiroyuki')

        expect(sleep_durations).to eq([1.0, 2.0, 4.0])
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
        adapter.mock_response_proc = ->(_) {
          { 'scores' => { empathy: 25, humor: 15, brevity: 15, originality: 15, expression: 15 }, 'comment' => 'test' }
        }
        result = adapter.judge('テスト投稿', persona: 'hiroyuki')

        expect(result.succeeded).to be false
        expect(result.error_code).to eq('invalid_response')
      end

      it 'commentが空文字列の場合はinvalid_responseエラーコードを返すこと' do
        adapter.mock_response_proc = ->(_) {
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
        adapter.mock_response_proc = ->(attempt) {
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

        expect(Rails.logger).to receive(:error).with(/審査失敗/)
        adapter.judge('テスト投稿', persona: 'hiroyuki')
      end
    end
  end

  describe '抽象メソッド' do
    it 'clientメソッドがNotImplementedErrorを発生させること' do
      adapter = described_class.new
      expect {
        adapter.send(:client)
      }.to raise_error(NotImplementedError, /must be implemented/)
    end

    it 'build_requestメソッドがNotImplementedErrorを発生させること' do
      adapter = described_class.new
      expect {
        adapter.send(:build_request, 'test', 'hiroyuki')
      }.to raise_error(NotImplementedError, /must be implemented/)
    end

    it 'parse_responseメソッドがNotImplementedErrorを発生させること' do
      adapter = described_class.new
      expect {
        adapter.send(:parse_response, {})
      }.to raise_error(NotImplementedError, /must be implemented/)
    end

    it 'api_keyメソッドがNotImplementedErrorを発生させること' do
      adapter = described_class.new
      expect {
        adapter.send(:api_key)
      }.to raise_error(NotImplementedError, /must be implemented/)
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
      expect(results.all? { |r| r.succeeded }).to be true
    end

    it '共有状態の変更が他のスレッドに影響しないこと' do
      adapter.mock_response = described_class::JudgmentResult.new(
        succeeded: true,
        error_code: nil,
        scores: base_scores,
        comment: '成功'
      )

      threads = 5.times.map do |i|
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
```

---

## 4. テスト実行方法

### Redテストの実行

```bash
# サポートディレクトリの作成（TestAdapter用）
mkdir -p /home/nukon/ws/aruaruarena/spec/support

# テストディレクトリの作成
mkdir -p /home/nukon/ws/aruaruarena/spec/adapters

# TestAdapterを配置
# （上記のTestAdapterコードを spec/support/test_adapter.rb として保存）

# テストファイルの作成
# （上記のテストコードを spec/adapters/base_ai_adapter_spec.rb として保存）

# Redテストの実行（BaseAiAdapter未実装状態）
cd /home/nukon/ws/aruaruarena
bundle exec rspec spec/adapters/base_ai_adapter_spec.rb

# 詳細な出力で実行
bundle exec rspec spec/adapters/base_ai_adapter_spec.rb --format documentation
```

### 期待される失敗パターン

**BaseAiAdapter未実装時のエラー**:
```
NameError:
  uninitialized constant BaseAiAdapter
```

**メソッド未実装時のエラー**:
```
NoMethodError:
  undefined method `judge' for #<TestAdapter:0x...>
```

---

## 5. 関連ファイル

| ファイル | 用途 |
|---------|------|
| `spec/adapters/base_ai_adapter_spec.rb` | 作成するテストファイル |
| `spec/support/test_adapter.rb` | テスト用モッククラス |
| `app/adapters/base_ai_adapter.rb` | テスト対象クラス（未実装） |
| `app/models/judgment.rb` | バイアス計算ロジックの参照 |
| `spec/models/judgment_spec.rb` | 既存テストパターンの参照（バイアステストは重複あり） |

---

## 6. 禁止事項の確認（CLAUDE.md準拠）

- [x] `.permit!` を使用していない
- [x] N+1クエリの問題がない
- [x] ハードコードされた機密情報を含んでいない
- [x] `binding.pry` を含んでいない
- [x] コメントは日本語で記述している
- [x] コミットメッセージにIssue番号を含める

---

## 7. 受入条件との対応

| 受入条件 | 対応テスト |
|---------|-----------|
| 有効なpost_contentとpersonaでJudgmentResultが返され、succeededがtrue | T23-T26 |
| ペルソナバイアスが適用されたスコアが含まれる | T31-T36 |
| post_contentがnilでArgumentErrorが発生 | T08 |
| post_contentが3-30文字の範囲外でArgumentErrorが発生 | T11-T14 |
| 不正なpersonaでArgumentErrorが発生 | T22 |
| タイムアウト時MAX_RETRIES回リトライしerror_codeが"timeout" | T28-T30 |
| ひろゆき風のバイアス: 独創性+3、共感度-2、0-20の範囲内 | T31-T32 |
| デヴィ婦人風のバイアス: 表現力+3、面白さ+2 | T33-T34 |
| 中尾彬風のバイアス: 面白さ+3、共感度+2 | T35-T36 |

すべての受入条件をカバーしています。

---

## 8. 注意点

### 既存のJudgmentSpecとの重複について

`spec/models/judgment_spec.rb`の`.apply_persona_bias`テスト（L112-L141）と、本テストのバイアステスト（T31-T36）は機能的に重複しています。

**方針**:
- `JudgmentSpec`のバイアステストは、`Judgment.apply_persona_bias`クラスメソッドの単体テストとして維持
- 本テストのバイアステストは、`BaseAiAdapter#judge`メソッド経由でバイアスが正しく適用されることを確認する統合テストとして位置付け
- 両方のテストを維持することで、異なるレイヤーでのバイアス適用を検証

### TestAdapterのスコア範囲チェックについて

TestAdapterの`parse_response`メソッドにスコア範囲チェック（`invalid_scores?`）を実装していますが、これはテスト用のモック機能です。

**注意**: 本来このチェックは`BaseAiAdapter`側で実装すべきですが、Redフェーズでは`BaseAiAdapter`が未実装のため、テスト用モック側でエラーパターンをシミュレートしています。Greenフェーズで`BaseAiAdapter`に実装を移行してください。
