# EP28-01 リファクタリング・テスト改善 実装計画（レビュー反映版）

## 1. 目的
- 既存の振る舞いを変更せず、保守性と可読性を向上する。
- エッジケースのテストを補完し、将来のリグレッションを防ぐ。
- 変更後も既存テストをGreenで維持する。

## 2. 対象範囲
- `backend/app/services/rate_limiter_service.rb`
- `backend/spec/services/rate_limiter_service_spec.rb`
- `backend/app/services/judge_post_service.rb`
- `backend/spec/services/judge_post_service_spec.rb`

## 3. Issue_review観点での自己レビュー結果
- [重要度: 高]
  - 問題点: 初版では「振る舞いを変更しない」の判断基準が曖昧。
  - 改善提案: APIレスポンス/投稿ステータス遷移/Judgment保存件数を不変条件として明文化。
- [重要度: 中]
  - 問題点: エッジケースが主に正常系寄りで、障害時の境界条件が不足。
  - 改善提案: `shutdown_executor` の強制停止分岐、`set_limit!` の片系失敗、ログの個人情報非露出を追加。
- [重要度: 中]
  - 問題点: 非機能要件（ログ/性能）の検証が不足。
  - 改善提案: 並列実行設定値の定数化と、エラーログフォーマットの維持確認を含める。
- [重要度: 低]
  - 問題点: DynamoDB設計観点の記述不足。
  - 改善提案: 既存PK/SKやアクセスパターンは変更しないことを明記し、テーブル書き込み形式の回帰を防止。

## 4. 実施方針（Refactor観点）
### 3.1 エッジケース追加テスト
- `RateLimiterService`
  - `set_limit!` でニックネーム側の `set_limit` が失敗した場合も例外を送出せず継続すること。
  - `limited?` のログ出力時に識別子の一部が利用されること（生値を出力しないこと）。
- `JudgePostService`
  - `shutdown_executor` で `wait_for_termination` が `false` の場合に `kill` が呼ばれること。
  - `resolve_adapter_class` が `Class` と `Symbol` の両方を正しく解決すること。

### 3.2 コード改善
- マジックナンバーの定数化:
  - `JudgePostService#shutdown_executor` の待機秒数（`5`）
  - `JudgePostService#executor` のスレッド数（`3`）
- メソッド可読性向上:
  - `RateLimiterService#set_limit!` の重複した `begin-rescue` を共通化。
  - `RateLimiterService#limited?` のログ用ハッシュ切り出しを小メソッド化。
- 不要処理削減:
  - `JudgePostService#put_item_without_condition` / `save_judgments!` 周辺の重複処理を整理し、責務を明確化。

### 3.3 コメント追加
- 複雑なロジック（並列実行・フェイルオープン・タイムアウト制御）に対し、日本語コメントを最小限追加。

## 5. 不変条件（振る舞い非変更の定義）
- 投稿ステータス遷移: `judging -> scored/failed` の判定ロジックを変更しない。
- Rate Limit判定: `IP OR ニックネーム` の制限条件を変更しない。
- DynamoDB書き込み: `Judgment` の属性構造（必須キー、成功時スコア保存）を変更しない。
- 例外時方針: フェイルオープン（投稿処理継続）を維持する。

## 6. 受け入れ基準
- 既存機能の外部仕様（APIレスポンス、ステータス遷移）に変更がない。
- 追加したテストを含め全テストがGreen。
- `scripts/test_all.sh` 実行で失敗がない。
- 追加コメントは日本語で、冗長でない。

## 7. 実施手順
1. 既存コード調査とベースライン確認。
2. 追加テストを先に作成（Red想定）。
3. 既存仕様を維持したままリファクタリング実装。
4. 追加テストと既存テストをGreen化。
5. `scripts/test_all.sh` 実行。
6. CodeRabbit自動レビュー実行（`coderabbit review --plain`）。
7. 指摘があれば修正し再検証。
8. `CLAUDE.md` 形式でコミット。

## 8. 検証コマンド
```bash
bash scripts/test_all.sh
```

## 9. 予定コミットメッセージ
```text
refactor: E28-01 サービス層の可読性改善とテスト補完 #101

- RateLimiterServiceの重複処理を整理し可読性を向上
- JudgePostServiceのマジックナンバーを定数化
- エッジケーステストを追加して退行を防止
- scripts/test_all.sh と自動レビューの結果を反映
```
