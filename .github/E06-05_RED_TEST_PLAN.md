# E06-05 REDテスト実装プラン

作成日: 2026-02-12
更新日: 2026-02-12（レビュー反映）
Epic: E06 AI審査システム
ストーリー: E06-05 JudgePostServiceの実装（並列処理）
フェーズ: RED（テストファースト実装）

---

## 1. コンテキスト（背景）

### 目的
- TDDサイクルのREDフェーズとして、実装前に失敗するテストコードを書く
- E06-05の受入条件をカバーするテストを実装する
- GREENフェーズでテストを通過する実装を行う準備を整える

### 前提条件
- `JudgePostService` は現在スタブ実装（NotImplementedErrorをraise）
- AI Adapters（Gemini, GLM, OpenAI）は実装済み
- `DewiAdapter` は未実装
- テストファイル `spec/services/judge_post_service_spec.rb` は未作成
- テストファイル `spec/adapters/dewi_adapter_spec.rb` は未作成

### CLAUDE.mdの遵守事項
- REDテストは必ず失敗する状態で出力（NoMethodError等が発生することを期待）
- コミットメッセージにIssue番号を含める
- 各テストに「何を検証するか」のコメントを付ける

### REDテスト完了後のフロー
- REDテスト実装完了 → GREENフェーズでDewiAdapterとJudgePostServiceを実装
- 全テストが通過したら、次のEpic（E07）またはREFACTORフェーズへ

---

## 2. 実装計画

### Phase 1: DewiAdapterのREDテスト

**ファイル**: `backend/spec/adapters/dewi_adapter_spec.rb`（新規作成）

**テスト構造**:

```ruby
# frozen_string_literal: true

require 'rails_helper'
require 'webmock/rspec'

# Issue: E06-05
RSpec.describe DewiAdapter do
  # 何を検証するか: BaseAiAdapterを継承していること
  it 'BaseAiAdapterを継承していること' do
    expect(described_class < BaseAiAdapter).to be true
  end

  # 何を検証するか: 定数の定義
  describe '定数' do
    it 'PROMPT_PATH定数が定義されていること' do
      expect(described_class::PROMPT_PATH).to be_a(String)
    end

    it 'PROMPT_PATH定数が正しいパスを返すこと' do
      expected_path = Rails.root.join('app/prompts/dewi.txt')
      expect(described_class::PROMPT_PATH).to eq(expected_path)
    end
  end

  # 何を検証するか: プロンプトファイルが読み込まれていること
  describe '初期化' do
    context '正常系' do
      it 'プロンプトファイルを読み込むこと' do
        adapter = described_class.new
        expect(adapter.instance_variable_get(:@prompt)).to include('あなたは「デヴィ婦人風」')
      end

      it 'プロンプトに{post_content}プレースホルダーが含まれること' do
        adapter = described_class.new
        expect(adapter.instance_variable_get(:@prompt)).to include('{post_content}')
      end

      it 'プロンプトファイルがキャッシュされること' do
        adapter1 = described_class.new
        adapter2 = described_class.new

        expect(adapter1.instance_variable_get(:@prompt)).to eq(adapter2.instance_variable_get(:@prompt))
      end
    end

    context '異常系' do
      it 'プロンプトファイルが存在しない場合は例外を発生させること' do
        allow(File).to receive(:exist?).with(described_class::PROMPT_PATH).and_return(false)

        expect do
          described_class.new
        end.to raise_error(ArgumentError, /プロンプトファイルが見つかりません/)
      end
    end
  end

  # 何を検証するか: Faradayクライアントの設定
  describe '#client' do
    it 'Faraday::Connectionインスタンスを返すこと' do
      adapter = described_class.new
      expect(adapter.send(:client)).to be_a(Faraday::Connection)
    end

    it 'GLM APIのベースURLが設定されていること' do
      adapter = described_class.new
      client = adapter.send(:client)
      expect(client.url_prefix.to_s).to include('open.bigmodel.cn')
    end

    it 'SSL証明書の検証が有効であること' do
      adapter = described_class.new
      client = adapter.send(:client)
      expect(client.ssl.verify).to be true
    end
  end

  # 何を検証するか: APIキーの取得
  describe '#api_key' do
    context '正常系' do
      before do
        stub_env('GLM_API_KEY', 'test_api_key')
      end

      it 'GLM_API_KEY環境変数を返すこと' do
        adapter = described_class.new
        expect(adapter.send(:api_key)).to eq('test_api_key')
      end
    end

    context '異常系' do
      before do
        stub_env('GLM_API_KEY', nil)
      end

      it 'GLM_API_KEYが設定されていない場合は例外を発生させること' do
        adapter = described_class.new
        expect do
          adapter.send(:api_key)
        end.to raise_error(ArgumentError, 'GLM_API_KEYが設定されていません')
      end
    end
  end

  # 何を検証するか: リクエストの構築
  describe '#build_request' do
    let(:adapter) { described_class.new }
    let(:post_content) { 'テスト投稿' }
    let(:persona) { 'dewi' }

    it 'リクエストボディが正しく構築されること' do
      request = adapter.send(:build_request, post_content, persona)
      expect(request[:model]).to eq('glm-4-flash')
      expect(request[:messages]).to be_a(Array)
      expect(request[:messages].first[:content]).to include('テスト投稿')
    end

    it 'temperatureとmax_tokensが設定されていること' do
      request = adapter.send(:build_request, post_content, persona)
      expect(request[:temperature]).to eq(0.7)
      expect(request[:max_tokens]).to eq(1000)
    end
  end

  # 何を検証するか: スコアバリデーション
  describe 'スコアバリデーション' do
    context '正常系' do
      it '有効なスコア（0-20）を受け付けること' do
        # GREENフェーズで実装後に検証可能
        skip 'DewiAdapterのparse_responseメソッド実装後に有効化'
      end
    end

    context '異常系' do
      it '無効なスコア（範囲外）は拒否されること' do
        skip 'DewiAdapterのparse_responseメソッド実装後に有効化'
      end
    end
  end
end

# 環境変数モック用ヘルパー
def stub_env(key, value)
  allow(ENV).to receive(:[]).with(key).and_return(value)
end
```

**期待される失敗理由**:
- `DewiAdapter` クラスが存在しないため `NameError: uninitialized constant DewiAdapter`（テストロード時）

---

### Phase 2: JudgePostServiceのREDテスト

**ファイル**: `backend/spec/services/judge_post_service_spec.rb`（新規作成）

**テスト構造**:

```ruby
# frozen_string_literal: true

require 'rails_helper'

# Issue: E06-05
RSpec.describe JudgePostService do
  # 何を検証するか: 定数の定義
  describe '定数' do
    it 'JUDGES定数が定義されていること' do
      expect(described_class::JUDGES).to be_a(Array)
      expect(described_class::JUDGES.size).to eq(3)
    end

    it 'JUDGESに3人の審査員が含まれること' do
      judges = described_class::JUDGES
      personas = judges.map { |j| j[:persona] }
      expect(personas).to contain_exactly('hiroyuki', 'dewi', 'nakao')
    end

    it 'JOIN_TIMEOUT定数が定義されていること' do
      expect(described_class::JOIN_TIMEOUT).to eq(120)
    end
  end

  # 何を検証するか: 初期化時の挙動
  describe '.call' do
    context '正常系' do
      let(:post) { Post.create(nickname: 'テスト', body: 'スヌーズ押して二度寝') }

      it 'JudgePostServiceのインスタンスを生成してexecuteを呼び出すこと' do
        expect do
          described_class.call(post.id)
        end.not_to raise_error
      end

      it 'Postが見つからない場合はWARNログを出力して何もしないこと' do
        expect(Rails.logger).to receive(:warn).with(/Post not found/)
        expect do
          described_class.call('nonexistent_id')
        end.not_to raise_error
      end
    end
  end

  # 何を検証するか: 並列審査の実行
  describe '#execute' do
    let(:post) { Post.create(nickname: 'テスト', body: 'スヌーズ押して二度寝') }
    let(:service) { described_class.new(post.id) }

    context '正常系' do
      # 何を検証するか: 3人全員成功時にstatus: scoredになること
      it '3人全員成功時にstatus: scoredになること' do
        # 注: REDフェーズではMock設定を省略（NotImplementedErrorで十分）
        # GREENフェーズでMock設定を追加
        skip 'DewiAdapterとJudgePostServiceの実装後に有効化'
      end

      # 何を検証するか: 2人成功時にstatus: scoredになること
      it '2人成功時にstatus: scoredになること' do
        skip 'DewiAdapterとJudgePostServiceの実装後に有効化'
      end

      # 何を検証するか: 平均点が小数第1位に丸められること
      it '平均点が小数第1位に丸められること（四捨五入）' do
        skip 'DewiAdapterとJudgePostServiceの実装後に有効化'
      end
    end

    context '異常系' do
      # 何を検証するか: 全員失敗時にstatus: failedになること
      it '全員失敗時にstatus: failedになること' do
        skip 'DewiAdapterとJudgePostServiceの実装後に有効化'
      end

      # 何を検証するか: 1人成功時にstatus: failedになること
      it '1人成功時にstatus: failedになること' do
        skip 'DewiAdapterとJudgePostServiceの実装後に有効化'
      end

      # 何を検証するか: Postがnilの場合は何もしないこと
      it 'Postがnilの場合は何もしないこと' do
        service_nil = described_class.new(nil)
        expect(Rails.logger).to receive(:warn).with(/Post not found/)
        expect { service_nil.execute }.not_to raise_error
      end

      # 何を検証するか: Thread内で例外発生時に失敗として記録されること
      it 'Thread内で例外発生時に失敗として記録されること' do
        skip 'DewiAdapterとJudgePostServiceの実装後に有効化'
      end
    end

    context '境界値・タイムアウト' do
      # 何を検証するか: タイムアウト発生時にerror_code: timeoutになること
      it 'タイムアウト発生時にerror_code: timeoutになること' do
        skip 'DewiAdapterとJudgePostServiceの実装後に有効化'
      end

      # 何を検証するか: 混合パターンで正しくステータスが決まること
      it '混合パターンで正しくステータスが決まること' do
        skip 'DewiAdapterとJudgePostServiceの実装後に有効化'
      end
    end

    # 何を検証するか: 並列実行の検証
    it '3人の審査員が同時に実行されること' do
      skip 'DewiAdapterとJudgePostServiceの実装後に有効化'
    end
  end

  # 何を検証するか: 審査結果の保存
  describe '#save_judgments!' do
    let(:post) { Post.create(nickname: 'テスト', body: 'スヌーズ押して二度寝') }
    let(:service) { described_class.new(post.id) }

    it '成功した審査結果がJudgmentテーブルに保存されること' do
      skip 'DewiAdapterとJudgePostServiceの実装後に有効化'
    end

    it '失敗した審査結果もJudgmentテーブルに保存されること' do
      skip 'DewiAdapterとJudgePostServiceの実装後に有効化'
    end
  end

  # 何を検証するか: ステータス更新
  describe '#update_post_status!' do
    let(:post) { Post.create(nickname: 'テスト', body: 'スヌーズ押して二度寝') }
    let(:service) { described_class.new(post.id) }

    context 'scoredの場合' do
      it '2人以上成功時にstatus: scoredになること' do
        skip 'DewiAdapterとJudgePostServiceの実装後に有効化'
      end
    end

    context 'failedの場合' do
      it '1人成功時にstatus: failedになること' do
        skip 'DewiAdapterとJudgePostServiceの実装後に有効化'
      end
    end
  end
end
```

**期待される失敗理由**:
- `JudgePostService::JUDGES` 定数が存在しないため `NameError`（定数テスト時）
- `JudgePostService#save_judgments!` メソッドが存在しないため `NoMethodError`（メソッドテスト時）
- `JudgePostService#update_post_status!` メソッドが存在しないため `NoMethodError`（メソッドテスト時）
- 実装されていない並列実行ロジックのため、`#execute` テストはNotImplementedErrorが発生（現在の動作）

**REDフェーズのテスト方針**:
- 実装されていない定数・メソッドを検証するテストは、`NameError` や `NoMethodError` が発生することを期待
- 実装されたメソッドの挙動を検証するテストは、`skip` を使用してGREENフェーズで有効化
- これにより、REDフェーズでは「未実装であること」を確認できる

---

## 3. 実装するファイル一覧

### 新規作成
1. `backend/spec/adapters/dewi_adapter_spec.rb`
2. `backend/spec/services/judge_post_service_spec.rb`
3. `backend/spec/support/adapter_test_helpers.rb`（共通ヘルパー）

### 参照ファイル（既存）
- `backend/spec/adapters/gemini_adapter_spec.rb` - テスト構造の参考
- `backend/app/adapters/base_ai_adapter.rb` - JudgmentResult構造体の定義
- `backend/app/models/post.rb` - Postモデルのメソッド定義
- `backend/app/models/judgment.rb` - Judgmentモデルのメソッド定義

---

## 4. 受入条件（REDテスト完了時）

- [ ] `DewiAdapter` のテストファイルが作成されている
- [ ] `JudgePostService` のテストファイルが作成されている
- [ ] 全てのテストが「何を検証するか」のコメントが付いている
- [ ] テスト実行時に失敗することが確認されている（RED状態）
- [ ] 環境変数モック用ヘルパーが定義されている

---

## 5. 検証手順

```bash
# 1. REDテスト実行（失敗することを確認）
cd backend
bundle exec rspec spec/adapters/dewi_adapter_spec.rb
bundle exec rspec spec/services/judge_post_service_spec.rb

# 2. 期待されるエラーを確認
# - DewiAdapter: NameError: uninitialized constant DewiAdapter
# - JudgePostService::JUDGES: NameError: uninitialized constant JudgePostService::JUDGES
# - JudgePostService#save_judgments!: NoMethodError: undefined method 'save_judgments!'
# - JudgePostService#update_post_status!: NoMethodError: undefined method 'update_post_status!'
```

---

## 6. コミットメッセージ

```
test: E06-05 REDテストを実装 #34

- DewiAdapterのテストファイルを作成
- JudgePostServiceのテストファイルを作成
- 受入条件をカバーするテストケースを追加
- 各テストに「何を検証するか」のコメントを追加
- 環境変数モック用ヘルパーを追加

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

---

## 7. 注記

### REDテストの特徴
- 実装前にテストを書くため、全てのテストが失敗することを期待
- クラス定数（DewiAdapter）が存在しないため、テストロード時に `NameError` が発生
- メソッド（JUDGES, save_judgments!, update_post_status!）が存在しないため、テスト実行時に `NoMethodError` が発生
- REDフェーズでは、実装されたメソッドの挙動を検証するテストは `skip` を使用して後回し
- これはTDDサイクルの正常な開始点（RED → GREEN → REFACTOR）

### 次のフェーズ（GREEN）
- DewiAdapterを実装してテストを通過させる
- JudgePostServiceの並列実行ロジックを実装する
- Mock設定を有効化して、実際のAdapter呼び出しをテスト可能にする
- skipされたテストを有効化する

### 共通ヘルパーの分離
- `spec/support/adapter_test_helpers.rb` に `stub_env` を定義して再利用する
- 他のAdapterテストでも同様のヘルパーが必要になった場合に備える
