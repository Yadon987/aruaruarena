# [PLAN] E17 プライバシーポリシー REDテスト実装計画

## 📋 概要
`.github/E17_privacy_policy_frontend_plan.md` の受入条件を、実装前に失敗するREDテストへ分解して先行作成する計画。

## 🎯 目的
- 受入条件（AC）をテストケースへ1対1でマッピングする。
- すべてのREDテストを「現状では失敗する状態」で追加し、Green実装の完了条件を明確化する。
- `CLAUDE.md` の禁止事項（日本語コメント、日本語コミット、テストなし実装禁止）を満たす。

---

## 🧭 対象範囲

### テスト対象ファイル（新規）
- `frontend/src/features/top/__tests__/PrivacyPolicyModal.red.test.tsx`
- `frontend/e2e/privacy-policy-modal.red.spec.ts`

### 参照する既存ファイル
- `frontend/src/App.tsx`
- `frontend/e2e/fixtures/test-fixtures.ts`
- `frontend/src/features/result/__tests__/ResultModalFlow.red.test.tsx`（コメント/命名規約参照）

---

## 🧪 REDテスト設計（受入条件カバレッジ）

### A. React Testing Library（Component/Integration）
- `E17 RED: トリガー押下でdialog表示`
- `E17 RED: 閉じるボタンで閉じる`
- `E17 RED: 背景オーバーレイ押下で閉じる`
- `E17 RED: Escで閉じる`
- `E17 RED: Tab/Shift+Tabでフォーカストラップ循環`
- `E17 RED: 閉じた後にトリガーへフォーカス復帰`
- `E17 RED: 本文領域にoverflow-y-auto/max-h適用`
- `E17 RED: 連続開閉・Esc連打でも最終状態が一致`
- `E17 RED: 自分の投稿一覧モーダルと同時表示されない`

### B. Playwright E2E
- `E17 RED: トップ画面から開いて閉じる導線`
- `E17 RED: Escで閉じる`
- `E17 RED: 本文領域がスクロール可能`
- `E17 RED: モーダル表示中は背景スクロールしない`

### C. AC対応表（トレーサビリティ）
| AC ID | 受入条件要約 | RTL | E2E |
|------|-------------|-----|-----|
| AC-01 | ボタン押下でモーダル表示 | トリガー押下でdialog表示 | トップ画面から開いて閉じる導線 |
| AC-02 | 閉じる操作で閉じる＋フォーカス復帰 | 閉じるボタンで閉じる / フォーカス復帰 | トップ画面から開いて閉じる導線 |
| AC-03 | Tab循環でモーダル外に出ない | Tab/Shift+Tabでフォーカストラップ循環 | - |
| AC-04 | モーダル未表示時Escで変化なし | Escで閉じる（未表示ケースを同ファイルで追加） | Escで閉じる |
| AC-05 | 単一モーダル表示維持 | 自分の投稿一覧と同時表示されない | - |
| AC-06 | 長文時スクロール可能 | overflow-y-auto/max-h適用 | 本文領域がスクロール可能 |
| AC-07 | 連続操作でも状態整合 | 連続開閉・Esc連打 | - |
| AC-08 | 背景スクロール抑止 | - | モーダル表示中は背景スクロールしない |

---

## ✅ RED状態の担保方法
- 既存コードに `PrivacyPolicyModal` が未実装の前提で期待値を定義する。
- テスト名に `E17 RED` を含める。
- RTLの `it` とPlaywrightの `test` の全ケース先頭に、`// 何を検証するか:` コメントを必須とする。
- 失敗理由は「未実装」に限定し、期待値が過剰で失敗しないようにする。

---

## 🔧 実装手順（REDのみ）
1. `frontend/src/features/top/__tests__/PrivacyPolicyModal.red.test.tsx` を作成する。  
2. 受入条件対応のRTL 9+ケースを追加する。  
3. `frontend/e2e/privacy-policy-modal.red.spec.ts` を作成する。  
4. `frontend/e2e/fixtures/test-fixtures.ts` を利用してE2E 4ケースを追加する。  
5. `cd frontend && npm run test -- PrivacyPolicyModal.red.test.tsx` を実行する。  
6. `cd frontend && npm run test:e2e -- privacy-policy-modal.red.spec.ts` を実行する。  
7. 各コマンドが終了コード1（Fail）で終了し、少なくとも1件以上Failしていることを確認する。  

---

## 🧾 コミット計画
- コミットメッセージ案: `test: E17-03 プライバシーポリシーREDテストを追加 #75`
- 本文（3行目以降）は以下を箇条書きで記載する。
  - AC対応表（AC IDごとのRTL/E2E対応）
  - RED失敗を確認した実行コマンド
  - Green実装が次ステップであること

---

## 🔍 事前チェック（CLAUDE.md準拠）
- [ ] コメントが日本語になっている
- [ ] コミットメッセージが日本語かつIssue番号 `#75` を含む
- [ ] RTLとE2Eの全テストに `// 何を検証するか:` がある
- [ ] テストコード追加なしで実装しない
- [ ] 機密情報をハードコードしない
- [ ] `binding.pry` を含めない

---

## 完了条件
- REDテストファイル2本が作成済み
- AC-01〜AC-08がテストへマッピング済み
- 全テストに `// 何を検証するか:` コメントがある
- `npm run test -- PrivacyPolicyModal.red.test.tsx` がFailする
- `npm run test:e2e -- privacy-policy-modal.red.spec.ts` がFailする
