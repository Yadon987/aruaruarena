# [PLAN] E17 プライバシーポリシー Refactor実装計画

## 📋 概要
Green済みの E17 実装を対象に、振る舞いを変えずに可読性・保守性・テスト信頼性を向上する Refactor フェーズ計画。

## 🎯 目的
- 既存テストの全パスを維持したまま内部実装を整理する。
- エッジケースを追加テストで補強し、回帰耐性を高める。
- `CLAUDE.md` のルール（日本語コメント・Issue番号付きコミット）を満たす。

---

## スコープ

### 対象
- `frontend/src/features/top/components/PrivacyPolicyModal.tsx`
- `frontend/src/features/top/constants/privacyPolicy.ts`
- `frontend/src/App.tsx`（E17に関係する範囲のみ）
- `frontend/src/features/top/__tests__/PrivacyPolicyModal.red.test.tsx`
- `frontend/e2e/privacy-policy-modal.red.spec.ts`

### 非対象
- UI仕様の変更
- 法務文言の確定編集
- 新規機能追加

---

## 1. 追加テスト

### 必須（今回必ず追加）
- RTL:
  - 先頭要素で `Shift+Tab` したとき末尾へ循環する。
  - 末尾要素で `Tab` したとき先頭へ循環する。
  - 背景クリックで閉じた場合でもトリガーへフォーカス復帰する。
- E2E:
  - モーダルを閉じた後に `プライバシーポリシー` ボタンへフォーカス復帰する。

### 任意（時間があれば追加）
- RTL: `Esc` 押下時の `preventDefault` 適用を検証。
- E2E: `Tab` 連打でもフォーカスがモーダル外へ抜けないことを検証。

### Red確認の定義
- Red確認は「今回追加した新規テストのみFail」を確認対象にする。
- 既存テストをFailさせる変更は行わない。

---

## 2. コード改善

### マジックナンバーの定数化
- `frontend/src/features/top/components/PrivacyPolicyModal.tsx`
  - フォーカス関連セレクタ・キー定数を整理（既存がある場合は統合）。
- `frontend/e2e/privacy-policy-modal.red.spec.ts`
  - `1200`（wheel量）、`100`（wait）、`200`（scrollTop）を定数化。

### メソッドの可読性向上
- `PrivacyPolicyModal.tsx`
  - `handleKeyDown` を `handleEscapeKey` / `handleFocusTrap` に分割。
  - `getFocusableElements` を切り出して責務分離。
- `App.tsx`
  - `openMyPosts` / `openPrivacyPolicy` / `closeMyPosts` / `closePrivacyPolicy` の重複処理を最小限で共通化。

### 不要な処理の削除
- 未使用変数、重複分岐、不要な状態更新を除去。
- 振る舞いを変えない範囲で早期returnと処理順を統一。

---

## 3. コメント追加（日本語）
- フォーカストラップ循環ロジックに「境界で循環させる理由」をコメント追加。
- 背景スクロール抑止の cleanup が必要な理由をコメント追加。
- E2E待機の意図（フレーキー回避）をコメント追加。

---

## 4. 非機能確認
- 不要な再レンダや再計算を増やさない（軽量確認）。
- `scripts/test_all.sh` 実行時間が極端に悪化しないことを確認。

---

## 実行手順
1. 必須の追加テストを先に実装する。
2. 追加した新規テストのみFailすることを確認する（Red）。
3. コード改善を最小差分で実施する。
4. 追加テストと既存テストを全パスさせる（Green）。
5. `coderabbit review --plain` を実行する。
6. レビュー指摘を必要範囲で反映し、再テストする。
7. `bash scripts/test_all.sh` を実行する。
8. 失敗時は「失敗ログのテストを単体再実行 → 修正 → `bash scripts/test_all.sh` 再実行」を繰り返す。

---

## 確認コマンド
- `cd frontend && npm run test -- PrivacyPolicyModal.red.test.tsx`
- `cd frontend && npm run test:e2e -- privacy-policy-modal.red.spec.ts`
- `coderabbit review --plain`
- `bash scripts/test_all.sh`

---

## コミット計画

### 1コミットでまとめる場合
- `refactor: E17-04 プライバシー実装を整理 #75`

### 2コミットに分ける場合
- `test: E17-04 フォーカス系エッジケースを追加 #75`
- `refactor: E17-04 モーダル実装の可読性を改善 #75`

### コミット本文（3行目以降）
- 追加したエッジケーステスト
- 可読性改善の要点
- 実行した確認コマンド
- CodeRabbit指摘の反映内容

---

## 完了条件
- 必須追加テストがすべてパスする。
- 既存テストがすべてパスする。
- 振る舞い（UI/操作仕様）に変更がない。
- `bash scripts/test_all.sh` が成功する。
- CodeRabbit指摘への対応内容をコミットに記録する。
