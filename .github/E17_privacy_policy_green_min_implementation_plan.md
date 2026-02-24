# [PLAN] E17 プライバシーポリシー Green最小実装計画

## 📋 概要
`.github/E17_privacy_policy_red_test_plan.md` と Issue #75 の受入条件を基準に、現在失敗しているREDテストを通すための最小実装を定義する。

## 🎯 目的
- 追加済みREDテスト（RTL/E2E）をパスさせる。
- 実装は最小限に限定し、過剰な最適化や拡張は行わない。
- エッジケース強化はRefactorフェーズへ後送りする。

---

## スコープ

### 対象（今回実装する）
- フッターに `プライバシーポリシー` ボタンを追加
- `PrivacyPolicyModal` の新規実装
- 開閉（ボタン、閉じるボタン、Esc、背景クリック）
- `自分の投稿一覧` モーダルとの単一表示制御
- プライバシーポリシー本文の表示とスクロール領域の付与
- 背景スクロール抑止（E2Eの期待を満たす最小実装）

### 非対象（今回はやらない）
- 連打・連続開閉などのエッジケース対策
- 完全なフォーカストラップ実装
- 文言の法務レビュー最終化
- UIの微調整・アニメーション最適化

---

## ✅ テストパス対象

### RTL（`frontend/src/features/top/__tests__/PrivacyPolicyModal.red.test.tsx`）
- フッターにボタンが表示される
- ボタン押下でモーダル表示
- 閉じるボタンで閉じる
- Escで閉じる
- 閉じた後にトリガーへフォーカス復帰
- セクション見出し表示 + `overflow-y-auto` 付与
- `自分の投稿一覧` と同時表示されない

### E2E（`frontend/e2e/privacy-policy-modal.red.spec.ts`）
- 開いて閉じる導線
- Escで閉じる
- 本文領域がスクロール可能
- モーダル表示中は背景スクロールしない

---

## 🔧 変更方針（最小差分）

### 1. `frontend/src/features/top/constants/privacyPolicy.ts`（新規）
- 利用規約本文とプライバシーポリシー本文を定数で定義する。
- 長さはE2Eのスクロール判定を満たす最小限の分量を確保する。

### 2. `frontend/src/features/top/components/PrivacyPolicyModal.tsx`（新規）
- Props:
  - `isOpen: boolean`
  - `onClose: () => void`
  - `triggerRef?: React.RefObject<HTMLButtonElement | null>`
- `isOpen === false` は `null` を返す。
- ルート要素:
  - `role="dialog"`
  - `aria-modal="true"`
  - `aria-label="プライバシーポリシー"`
  - `tabIndex={-1}`
  - `onKeyDown` で `Escape` を処理
- 見出し:
  - `h2: プライバシーポリシー`
  - `h3: 利用規約`
  - `h3: プライバシーポリシー`
- スクロール領域（本文コンテナ）:
  - `data-testid="privacy-policy-scroll-area"`
  - `className` に `max-h-*` と `overflow-y-auto` を含める
- 閉じる導線:
  - 閉じるボタン
  - 背景オーバーレイクリック
  - `Esc` キー
- モーダルを閉じたら `triggerRef.current?.focus()` を実行する（最小フォーカス復帰）。

### 3. `frontend/src/App.tsx`（更新）
- 最小差分を優先し、既存 `isMyPostsOpen` を維持したまま `isPrivacyPolicyOpen` を追加する。
- 開閉の排他制御:
  - `openMyPosts` 実行時に `isPrivacyPolicyOpen = false`
  - `openPrivacyPolicy` 実行時に `isMyPostsOpen = false`
- フッターに `プライバシーポリシー` ボタンを追加し、`openPrivacyPolicy` を紐付ける。
- `PrivacyPolicyModal` を描画する。
- 背景スクロール抑止:
  - `isPrivacyPolicyOpen` が `true` のとき `document.body.style.overflow = 'hidden'`
  - `false` になったときとアンマウント時に `''` へ戻す（`useEffect` cleanup）

---

## 実装手順
1. 定数ファイル `privacyPolicy.ts` を作成する。
2. `PrivacyPolicyModal.tsx` を最小機能で作成する。
3. `App.tsx` にボタン/状態管理/モーダル描画を追加する。
4. `cd frontend && npm run test -- PrivacyPolicyModal.red.test.tsx` を実行する。
5. `cd frontend && npm run test:e2e -- privacy-policy-modal.red.spec.ts` を実行する。
6. テストが通るまで最小差分で修正する（余計なリファクタはしない）。

---

## 受入条件との対応（今回対象）
| 受入条件 | 今回の対応 |
|---|---|
| ボタン押下でモーダル表示 | フッターボタン + `isPrivacyPolicyOpen` で対応 |
| 閉じるボタンで閉じる | `onClose` で対応 |
| Escで閉じる | モーダルルート `onKeyDown` で対応 |
| 単一モーダル表示 | `isMyPostsOpen` と `isPrivacyPolicyOpen` の相互排他で対応 |
| 長文スクロール可能 | 本文コンテナへ `max-h` + `overflow-y-auto` で対応 |
| 背景スクロール抑止 | `body.style.overflow` 切替 + cleanupで対応 |

---

## テスト実行の前提
- E2Eは `playwright.config.ts` の `webServer` 起動が必要。
- 実行環境でポート待受（例: `5173`）が制限される場合、テストが起動前に失敗する。
- この制約への対処は環境設定の問題として扱い、本計画のアプリ実装差分には含めない。

---

## 完了条件
- 上記REDテストがパスする。
- 変更は `App.tsx` と E17関連新規ファイルに限定される。
- 追加実装は「テストを通すための最小限」に留まっている。
