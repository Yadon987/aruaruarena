# Refactor 計画書（レビュー反映版）

## 0. レビュー前提
- 対象: `frontend/src/App.tsx`, `frontend/src/features/top/components/PostFormModal.tsx`, `frontend/src/__tests__/App.optimisticSubmit.test.tsx`
- 方針: 振る舞い不変（Green継続）を最優先し、Refactor（可読性/保守性/境界値堅牢性）のみ改善する。
- 実施条件: 既存テストを壊さず、追加テストも含めて全件Greenを担保する。
- 参照レビュー: `.github/ISSUE_TEMPLATE/Issue_review.md`

## 1. Issue_review 観点レビュー（抜け防止）

### 1) 仕様の曖昧性
- 問題点
  - 「楽観的UIの最短遅延」「再投稿時刻差分再送」「同一投稿の連打時ガード」などが、現行計画だと定義が曖昧。
- 対策
  - 仕様を**受け入れ条件**として明文化し、テストに落とし込む。
  - 具体条件: 同一投稿の2重送信禁止、失敗復元時に入力値維持、エラー表示は審査画面内限定。

### 2) エッジケース・境界値
- 問題点
  - リファクタ時に分岐が増える箇所（`onSubmit` / ポーリング待機 / エラー復元）で取りこぼしが起きやすい。
- 対策
  - 追加（または拡張）するテストを固定し、以下を最小セットで保証する。
    - API失敗時: `judgingErrorMessage`表示、入力復元、`再投稿する`可否のガード
    - 失敗直後の連打再送: in-flightガードと`submit`二重実行抑止
    - `crypto.randomUUID`の固定値モック時でもPath/ID置換が崩れないこと
    - 失敗時も`history.replaceState`/`pushState`の不正呼び出し増分が起きないこと

### 3) セキュリティ
- 問題点
  - 今回対象はUI層だが、エラー文言・ログ文言にユーザー入力を混ぜる実装はXSS・情報露出リスクを生みやすい。
- 対策
  - 直接描画する文字列を必要最小化し、既存定数ベースに寄せる。
  - ログは既存仕様に従い、最小情報かつ構造化（`console.error('Post creation failed:', error)`）を維持しつつ過不足を確認。

### 4) 非機能要件（NFR）
- 問題点
- パフォーマンス面で無駄な再レンダリングや二重更新が増えやすい。
- 対策
  - state更新を1関数内で束ねる。
  - magic string/number/イベント名を`const`化し、再利用と変更コストを低減。
  - Polling開始条件（`isJudgingPollingReady`）を明文化し、副作用を最短化。

### 5) テスト観点
- 問題点
  - 既存テストが意図どおりか重複可能性を見落としやすい。
- 対策
- 既存`App.optimisticSubmit.test.tsx`の重複ケースを精査し、`describe/context`で責務分離。
  - 既存件数と同一網羅なら「追加しない」を明示し、重複を防止。
  - 追加が必要な場合のみ1ケースずつ `it` を追加して重複を回避。

### 6) DynamoDB設計（今回の対象外）
- 問題点
  - 本対象はフロント（楽観的UI）であり、DynamoDB設計検証項目は対象外。
- 対策
  - 計画書内に「影響範囲外」であることを明記し、バックエンド観点の混在を防ぐ。

### 7) 出力要件
- 問題点
  - 「Plan modeの最終成果物をファイル更新」指示が明確でないと取り残しが起きる。
- 対策
  - 最終成果物を `.github/refactor-optimistic-submit-ui.md` 1ファイルに集約し、レビュー反映後の最終版として上書き確定する。

## 2. Refactor 作業ゴール（現実実行順）

### 2.1 エッジケース追加テスト
- 対象: `frontend/src/__tests__/App.optimisticSubmit.test.tsx`
- 追加（または既存ケース再構成）:
  1. `再投稿する` 連打時に二重送信が発生しないガード
  2. API例外時に `pendingFormData` が復元され、再投稿時に同一値で開くこと
  3. `crypto.randomUUID`固定値のIDでも `history.pushState` 期待回数・パス遷移が崩れないこと
- 実施ルール:
  - 追加前に失敗を確認→実装→再テスト（Red→Green）
  - 既存同趣旨テストが存在する場合は追加しない

### 2.2 コード改善
- 対象: `frontend/src/App.tsx`
- 対象: `frontend/src/features/top/components/PostFormModal.tsx`
- 改善項目（TDD後半の内部実装改善）
  1. `const` 集約
     - 表示テキスト、SEキー、暫定IDプレフィックス、導線URL判定文字列などを定数化
     - 文字列同一利用個所を1つの定数へ集約
  2. メソッド可読性
     - `onSubmit` を機能別ローカル関数に分離
       - `startOptimisticJudging()`
       - `applyCreatedPostPath(officialId)`
       - `handleJudgingSubmitError(error)`
     - 1メソッド15行目安を意識し、状態遷移の順序をコメント付きで固定
  3. 不要処理削除
     - 2回目以降のモーダル遷移に伴う冗長state更新を整理
     - 失敗/中断時の片道復元だけを単一パスに集約
  4. PostFormModal
     - `initialNickname` / `initialBody` の反映を副作用単位で明確化
     - 開閉フローと初期値設定を分離し、将来の入力復元差し替えを容易にする

### 2.3 日本語コメント追加
- 対象: 複雑分岐に限定（全体へ過剰付与しない）
- 追加場所:
  - 楽観的遷移（モーダル閉じ→審査画面遷移）開始直前
  - 成功時の暫定ID差し替え
  - 失敗時の復元フロー
  - 判定待機（polling）開始条件

## 3. 受け入れ条件
- 既存テスト + 追加テストがすべてPass
- 既存UI/APIの振る舞いに変更なし（画面文言・表示遷移・API呼び出し順）
- Refactor対象ファイル内のハードコード削減（定数化）を確認
- 新規テストは重複がないこと
- テスト失敗があれば `scripts/test_all.sh` で再現ログ付きで原因対応

## 4. 確認コマンド
- `./scripts/test_all.sh`
- 失敗時は該当テストのみではなく、まず失敗事象を再現し、原因を切り分けてから最小修正

## 5. コミットルール
- 形式: `type: Exx-xx 説明文 #issue番号`
- 例:
  - `refactor: E12-03 楽観的投稿UIを保守改善 #00`
- 本文は変更ファイル、改善ポイント、追加テストを必ず箇条書き記載
- 改善内容のみを1コミットにまとめる（別タスクと混在させない）

## 6. 作業順（実行）
1. テスト追加 or 再編成（Red）
2. `App.tsx`の状態遷移分割（Green）
3. `PostFormModal.tsx`の初期値反映整理（Green）
4. 日本語コメント追加（見直し）
5. 重複テストの最終確認
6. `./scripts/test_all.sh` 実行
7. 結果をこの計画書に反映して完了報告
