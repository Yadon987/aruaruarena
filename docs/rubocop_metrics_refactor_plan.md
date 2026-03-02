# RuboCop Metrics 解消プロジェクト計画

## 1. 基本方針

- **分割統治**: Adapters（基盤・通信部分）と Services（ビジネスロジック）を完全に分けます。
- **テストファースト**: リファクタリング対象のコードには必ずRSpecを用意し、既存挙動を保護してから着手します。
- **小さなプルリクエスト (PR)**: 1ファイル、あるいは1メソッド単位で細かくPRを出し、レビューとマージを繰り返します。
- **完了条件の明確化**: 本計画の「実装完了」は、対象チケットで宣言した offense が解消され、対象ファイルに残る未解消 offense を明示した状態を指します。計画書更新だけで完了扱いにはしません。

## 2. 【フェーズ 1】準備と安全確保

まず、現状を「これ以上悪化させない」ための準備をします。

- **TODOファイルの作成**:
  - 現在の違反状態を `.rubocop_todo.yml` に吐き出し、CIが落ちない状態にします。
  - 新規コードは常にクリーンな状態で書くことを強制しつつ、本プロジェクトで計画的にTODOを減らしていきます。
- **目標値の明確化**:
  - `Metrics/AbcSize` (目標: 17以下、理想は15)
  - `Metrics/MethodLength` (実判定: 10行以内。
    `backend/.rubocop.yml` で上書きがないため RuboCop デフォルトに従う)
  - `Metrics/CyclomaticComplexity` (目標: 7以下)
- **テストカバレッジの確認**:
  - 今回対象の `base_ai_adapter.rb` や `judge_post_service.rb` などの
    既存テストを先に確認します。
  - 部分実行では SimpleCov の総合カバレッジが正しく出ないため、
    作業中は対象 spec の実行を優先し、
    最終確認で `COVERAGE=true bundle exec rspec` を用いて全体 90%以上を確認します。

## 3. 【フェーズ 2】Adapters 層のリファクタリング（継承構造の整理）

AI関連のアダプターの継承関係（Base -> Specific）を整理します。

- **対象ファイル**:
  - `base_ai_adapter.rb`
  - `base_glm_adapter.rb`
  - `base_open_ai_compat_adapter.rb`
  - `gemini_adapter.rb`

- **ステップ**:
  1. **`base_ai_adapter.rb` (親) の責務整理**
     - 共通メソッドが肥大化していないか確認します。
     - **アクション**: 共通処理（例：ログ出力、エラーハンドリング、共通ヘッダー生成）を
       プライベートメソッドに切り出し、テンプレートメソッドパターンを適用して構造を明確にします。
  2. **`base_open_ai_compat_adapter.rb` & `base_glm_adapter.rb` (中間層)**
     - 特定のAPI群（OpenAI互換など）への接続ロジックを整理します。
     - **アクション**: まず `execute_request` / `handle_response_status` /
       `parse_response` の長いメソッドをプライベートメソッドへ分割し、
       `MethodLength` と `AbcSize` を優先解消します。
     - **次段階**: なお `Metrics/ClassLength` が残る場合は、キャッシュ処理やレスポンス整形を Concern / 小クラスへ切り出して段階的に解消します。
  3. **`gemini_adapter.rb` (具象クラス)**
     - Gemini固有の処理の簡素化。
     - **アクション**: `extract_text_from_response` / `parse_response` /
       `execute_request` を優先して分割し、
       既に Concern 化した JSON パース処理を再利用して重複実装を減らします。

## 4. 【フェーズ 3】Services 層のリファクタリング（ロジックの分割）

ビジネスロジックの要であり、最も複雑になりがちな部分です。
振る舞いが変わらないよう特に注意します。

- **対象ファイル**:
  - `judge_post_service.rb`

- **ステップ**:
  1. **メインメソッドの軽量化**
     - メインの処理フロー（`call` などのエントリーポイント：15行以内遵守）だけを残し、具体的な計算や判定ロジックをプライベートメソッドへ退避させます。
  2. **バリデーションの抽出**
     - **アクション**: Guard Clauses（ガード節）を使ってネストを浅くするか、
       バリデーションロジックを別のプライベートメソッド（または専用の Validator オブジェクト）に切り出します。
  3. **責務の委譲 (Delegation)**
     - `JudgePostService` が「判定」以外の仕事（DB保存の複雑な整形など）をしている場合。
     - **アクション**: それらの処理を別のServiceやHelperクラスに切り出し、本Serviceはそれらを呼び出すだけにとどめます。

## 5. 【フェーズ 4】最終確認と品質保証

- **RuboCop再実行**: 対象ファイル単位で `bundle exec rubocop --cache false` を実行し、
  今回対象の offense が解消されたことを確認します。
- **残件の明示**: 今回のチケットで対象外とした offense（例: `Metrics/ClassLength`）が残る場合は、
  その件数と対象ファイルを記録して次チケットへ引き継ぎます。
- **RSpec全実行**: リグレッション（デグレ）がないか確認。
- **カバレッジ確認**: `COVERAGE=true bundle exec rspec` にて90%以上を維持しているか確認。
- **エッジケースの動作確認**: タイムアウトやAPIキー無効時など、エラーハンドリングのテストが全てパスすることを確認。

## 6. 具体的なアクションプラン（チケット分割案）

実作業として、以下の順序で進めることを推奨します。

- **チケット1: Adapters基盤の整理**
  - **目的**: `base_ai_adapter.rb` の Metrics 各種解消
  - **手法**: Privateメソッドへの切り出し、共通処理の整理
  - **期間目安**: 1〜2 PR想定（工数目安: 1日）
- **チケット2: 具体Adaptersの整理**
  - **目的**: `gemini_adapter.rb` 等の Metrics 解消
  - **手法**: 固有ロジックの簡素化、Parameter Object化
  - **期間目安**: 1〜2 PR想定（工数目安: 1日）
- **チケット3: Serviceのロジック分割**
  - **目的**: `judge_post_service.rb` の `Metrics/CyclomaticComplexity`,
    `AbcSize` 等の解消
  - **手法**: メソッド抽出、早期リターン（Guard Clause）の徹底、他クラスへの委譲
  - **安全策**: APIモックを用いたシナリオテストの拡充
  - **期間目安**: 細かく 3〜4 PRに分割（工数目安: 2日）
