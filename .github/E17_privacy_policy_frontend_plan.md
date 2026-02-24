# [SPEC] E17 プライバシーポリシー（フロントエンド）

## 📋 概要
トップ画面フッターから開ける「プライバシーポリシー／利用規約」モーダルを実装する。長文でも可読性を保つため本文領域をスクロール可能にし、キーボード操作とフォーカス制御を含むアクセシブルなモーダルとして提供する。

## 🎯 目的
- 法的情報への導線を提供し、ユーザーがデータ取り扱い方針を確認できる状態にする。
- 既存モーダルと同等の操作性（開閉、Esc、フォーカス管理、背景クリック）を担保する。
- 仕様をテストへ直接落とし込める粒度で定義し、実装時の解釈差異をなくす。

---

## 📝 詳細仕様

### 機能要件
- トップ画面フッターに `プライバシーポリシー` ボタンを追加する。
- ボタン押下で `PrivacyPolicyModal` を開く。
- モーダル内に「利用規約」「プライバシーポリシー」の2セクションを表示する。
- 本文は `frontend/src/features/top/constants/privacyPolicy.ts`（新規）で静的管理する。
- モーダル全体は `max-h-[90vh]`、本文コンテナは `overflow-y-auto` を設定し縦スクロール可能にする。
- モーダルの閉じ方は以下3通りを許可する。
  - 閉じるボタン
  - 背景オーバーレイクリック
  - `Esc` キー押下
- モーダルを開いた直後は閉じるボタンへフォーカスする。
- モーダル内の `Tab` / `Shift+Tab` はフォーカストラップで循環させる。
- モーダルを閉じた後は、開く前に押した `プライバシーポリシー` ボタンへフォーカスを戻す。
- 既存 `自分の投稿一覧` モーダルと同時表示しない（常に1モーダルのみ）。

### 非機能要件
- 追加ライブラリは導入しない（既存React/Tailwind実装のみ）。
- モーダル表示中は `document.body` の背景スクロールを無効化し、閉じたら必ず解除する。
- 既存トップ画面機能（投稿、ランキング、自分の投稿一覧）に回帰を起こさない。
- 既存審査結果モーダルの開閉挙動と衝突しない。

### UI/UX設計
- 既存 `ResultModal` の見た目と操作ルールを踏襲する。
- モーダルコンテナに `role="dialog"`、`aria-modal="true"`、`aria-label="プライバシーポリシー"` を付与する。
- 見出しは `h2: プライバシーポリシー` を表示する。
- セクション見出しは `h3: 利用規約` / `h3: プライバシーポリシー` を表示する。

---

## 🔧 技術仕様

### データモデル (DynamoDB)
| 項目 | 値 |
|------|-----|
| Table | N/A |
| PK | N/A |
| SK | N/A |
| GSI | N/A |

### API設計
| 項目 | 値 |
|------|-----|
| Method | N/A |
| Path | N/A |
| Request Body | N/A |
| Response (成功) | N/A |
| Response (失敗) | N/A |

### AIプロンプト設計
- N/A

### 実装対象ファイル（予定）
- `frontend/src/App.tsx`
- `frontend/src/features/top/components/PrivacyPolicyModal.tsx`（新規）
- `frontend/src/features/top/constants/privacyPolicy.ts`（新規）
- `frontend/src/features/top/__tests__/PrivacyPolicyModal.red.test.tsx`（新規）
- `frontend/e2e/privacy-policy-modal.red.spec.ts`（新規）

### 状態管理方針
- `App.tsx` のモーダル状態を `activeModal: 'none' | 'myPosts' | 'privacyPolicy'` へ統一する。
- `activeModal === 'privacyPolicy'` のときのみ `PrivacyPolicyModal` を表示する。

---

## 🧪 テスト計画 (TDD)

### Unit Test (Model/Service)
- [ ] 正常系: N/A（フロントエンドUI実装のため）
- [ ] 異常系: N/A（フロントエンドUI実装のため）
- [ ] 境界値: N/A（フロントエンドUI実装のため）

### Component/Integration Test (React Testing Library)
- [ ] トリガーボタン押下で `role="dialog"` かつ `aria-label="プライバシーポリシー"` のモーダルが表示される。
- [ ] 閉じるボタン押下でモーダルが閉じる。
- [ ] 背景オーバーレイ押下でモーダルが閉じる。
- [ ] `Esc` キー押下でモーダルが閉じる。
- [ ] モーダル表示中に `Tab` / `Shift+Tab` でフォーカス循環する。
- [ ] モーダルを閉じた後、フォーカスがトリガーボタンへ戻る。
- [ ] `overflow-y-auto` と `max-h-*` が本文領域に適用される。
- [ ] 多重操作（連続開閉、連打、Esc連打）でも状態が破綻しない。
- [ ] `自分の投稿一覧` モーダルと同時表示されない。

### E2E Test (Playwright)
- [ ] `トップ画面 -> プライバシーポリシーを開く -> 閉じる` が成功する。
- [ ] `Esc` で閉じる操作がブラウザ実行時に成功する。
- [ ] 本文領域で `scrollHeight > clientHeight` を満たし、`scrollTop` が増加してスクロール可能である。
- [ ] モーダル表示中に背景ページがスクロールしない。

### External Service (WebMock/VCR)
- [ ] モック対象: N/A

---

## ✅ 受入条件 (AC) - Given-When-Then

### 正常系 (Happy Path)
- [ ] **Given** ユーザーがトップ画面を開いている
      **When** フッターの「プライバシーポリシー」を押す
      **Then** `aria-label="プライバシーポリシー"` のモーダルが表示される

- [ ] **Given** プライバシーポリシーモーダルが表示されている
      **When** 閉じるボタンを押す
      **Then** モーダルが閉じ、トリガーボタンへフォーカスが戻る

- [ ] **Given** プライバシーポリシーモーダルが表示されている
      **When** `Tab` / `Shift+Tab` でフォーカス移動する
      **Then** フォーカスがモーダル外へ抜けない

### 異常系 (Error Path)
- [ ] **Given** モーダルが未表示
      **When** `Esc` キーを押す
      **Then** 画面状態が変化しない

- [ ] **Given** `自分の投稿一覧` モーダルが表示中
      **When** 「プライバシーポリシー」を開く操作を行う
      **Then** 同時表示されず、常に単一モーダル表示が維持される

### 境界値 (Edge Case)
- [ ] **Given** 本文が1画面に収まらない長さ
      **When** モーダルを開く
      **Then** 本文領域が縦スクロール可能で全内容を確認できる

- [ ] **Given** 開閉操作を短時間で連続実行する
      **When** ボタン連打または `Esc` 連打を行う
      **Then** 開閉状態が破綻せず、最終操作結果と一致する

---

## 🔗 関連資料
- `docs/epics.md`（E17）
- `frontend/src/features/result/components/ResultModal.tsx`（既存モーダル実装）

---

**レビュアーへの確認事項:**
- [ ] 仕様の目的が明確か
- [ ] モーダル開閉・フォーカス・スクロール要件が具体化されているか
- [ ] テスト計画は正常系/異常系/境界値を網羅しているか
- [ ] 受入条件はGiven-When-Then形式で記述されているか
- [ ] 既存機能や他の仕様と矛盾していないか
