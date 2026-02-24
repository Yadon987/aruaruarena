---
name: 仕様策定 (Spec)
about: 新機能や改善の仕様を定義する際に使用 (SDD/TDD/BDD準拠)
title: '[SPEC] E15-01〜E15-02/E15-06: 審査結果モーダルUIと結果表示'
labels: 'spec, E15, frontend'
assignees: ''
---

## 📋 概要

E15の推奨Issue分割の1つ目として、審査結果モーダルの基盤UIを実装します。対象はモーダルレイアウト（E15-01）、審査結果詳細表示（E15-02）、Framer Motionアニメーション（E15-06）、およびそれらに対応するPlaywright E2Eテストの一部（E15-07）です。

## 🎯 目的

- 審査完了後に投稿詳細と審査結果を一貫したモーダルUIで提示する
- `scored` / `failed` の状態差分を表示ルールとして明確化する
- 後続Issue（再審査・SNSシェア）を安全に実装できる土台を提供する

---

## 📝 詳細仕様

### 機能要件
- `ResultModal` コンポーネントを新規作成し、トップ画面上に重ねて表示する
- モーダルの起動条件を以下に統一する
  - ランキング項目クリック時
  - 審査中画面で `status` が `scored` または `failed` に遷移した時
  - 自分の投稿一覧から投稿を選択した時
- 表示項目は以下を必須とする
  - 投稿情報: ニックネーム、本文、平均点、順位
  - 審査員詳細: 審査員名、5項目スコア、合計点、コメント、成功/失敗ステータス
- `status=scored` のとき
  - 平均点を小数1桁で表示する
  - `rank` と `total_count` が揃っている場合のみ `n位 / total_count件中` を表示する
  - `rank` または `total_count` が欠損時は `順位情報を取得できませんでした` を表示する
- `status=failed` のとき
  - 順位は `---` を表示する
  - 平均点はAPIレスポンスに含まれる場合のみ表示する
- `judgments` の表示
  - 3件存在時は3件すべて表示する
  - 0件または欠損時は `審査結果はまだありません` を表示する
- モーダルを閉じる操作は以下を許可する
  - 閉じるボタン
  - `Esc` キー
  - 背景オーバーレイクリック
- アクセシビリティ
  - `role="dialog"` と `aria-modal="true"` を設定
  - モーダル表示時の初期フォーカスは閉じるボタン
  - `Tab` / `Shift+Tab` でフォーカスがモーダル内循環する
  - モーダルを閉じたら、開く直前にフォーカスしていた要素へフォーカスを戻す
- アニメーション
  - 開く: フェードイン + わずかな拡大（0.2〜0.3秒）
  - 閉じる: フェードアウト + わずかな縮小（0.15〜0.25秒）
  - `prefers-reduced-motion` 有効時はアニメーションを無効化する
- Issue 1ではアクションボタンはプレースホルダー扱いとする
  - 再審査ボタン、SNSシェアボタン、OGPプレビューは表示しない

### 非機能要件
- 既存トップ画面の操作性を阻害しない（モーダル表示中は背景スクロールをロック）
- 1投稿あたり審査員3件表示時でもレイアウト崩れがない
- モーダル初回表示から主要情報描画まで300ms以内（`npm run dev` のローカル環境でキャッシュヒット時）
- データ取得は `usePost(id)` を利用し、同一 `id` の再表示時はキャッシュを優先する
- 異なる `id` を短時間で連続選択した場合、最後に選択した `id` の結果のみ表示する
- API未取得時・取得失敗時の表示崩れを防止する

### UI/UX設計
- 画面種別: モーダル（背景にトップ画面を残す）
- レスポンシブ
  - SP: 全高に収まらない場合はモーダル本体のみ縦スクロール
  - PC: 最大幅を固定し中央表示
- ローディング
  - 取得中はスケルトンまたは `読み込み中...` を表示
- エラー表示
  - `NOT_FOUND`: `投稿が見つかりません`
  - それ以外: `投稿詳細の取得に失敗しました` + `再試行` ボタン

---

## 🔧 技術仕様

### データモデル (DynamoDB)
| 項目 | 値 |
|------|-----|
| Table | 既存テーブル利用のみ（新規追加なし） |
| PK | なし（フロント実装のみ） |
| SK | なし（フロント実装のみ） |
| GSI | なし（フロント実装のみ） |

### API設計
| 項目 | 値 |
|------|-----|
| Method | GET |
| Path | /api/posts/:id |
| Request Body | なし |
| Response (成功) | `Post`（`status`, `average_score`, `rank`, `total_count`, `judgments[]` を含む） |
| Response (失敗) | `{ error: "...", code: "..." }` |

### AIプロンプト設計
- N/A（フロントエンドUIのみ）

### 実装対象ファイル
- `frontend/src/features/result/components/ResultModal.tsx`（新規）
- `frontend/src/features/result/components/JudgeResultCard.tsx`（新規）
- `frontend/src/features/result/index.ts`（新規）
- `frontend/src/App.tsx`（モーダルの表示制御を接続）
- `frontend/src/shared/hooks/usePost.tsx`（再試行導線に必要な公開値の確認・調整）
- `frontend/src/shared/types/domain.ts`（必要時のみ型補強）

---

## 🧪 テスト計画 (TDD)

### Unit Test (Model/Service)
- [ ] 正常系:
  - `status=scored` で平均点と順位（`n位 / total_count件中`）が表示される
  - `status=failed` で順位が `---` 表示になる
  - 審査員3件のカードに5項目スコア/コメントが表示される
- [ ] 異常系:
  - `judgments` が空配列または欠損でもクラッシュせず空状態文言を表示する
  - `status=scored` で `rank`/`total_count` 欠損時に `順位情報を取得できませんでした` を表示する
  - `NOT_FOUND` とその他エラーで文言とUI導線が分岐する
- [ ] 境界値:
  - コメント長文（200文字以上）でレイアウト崩れしない
  - 最小スコア（0）と最大スコア（100）が正しく表示される
  - `prefers-reduced-motion=true` でアニメーションが無効化される

### Request Spec (API)
- [ ] `GET /api/posts/:id` - N/A（本Issueではバックエンド仕様変更なし）

### External Service (WebMock/VCR)
- [ ] モック対象:
  - MSWで `GET /api/posts/:id` の `scored` / `failed` / `judgments欠損` / `NOT_FOUND` / `500` をモック

### E2E Test (Playwright)
- [ ] ランキング投稿をクリックすると審査結果モーダルが開く
- [ ] `Esc` キーでモーダルが閉じ、トリガー要素へフォーカスが戻る
- [ ] モバイル幅でも主要情報（投稿本文・平均点・審査員カード）が閲覧可能
- [ ] 同一投稿を連続クリックしても重複リクエストで表示が破綻しない
- [ ] 別投稿へ素早く切り替えた場合、最後に選択した投稿の内容が表示される

---

## ✅ 受入条件 (AC) - Given-When-Then

### 正常系 (Happy Path)
- [ ] **Given** `status=scored` の投稿詳細レスポンスが取得済み
      **When** 対象投稿の結果モーダルを開く
      **Then** 投稿情報と3人分の審査結果詳細が表示される
      **And** 平均点と順位が表示される

- [ ] **Given** `status=failed` の投稿詳細レスポンスが取得済み
      **When** 結果モーダルを開く
      **Then** 順位表示は `---` になる
      **And** UIがエラーなく表示される

### 異常系 (Error Path)
- [ ] **Given** 投稿IDに対応するデータが存在しない
      **When** 結果モーダルを開く
      **Then** `投稿が見つかりません` を表示する

- [ ] **Given** 投稿詳細取得で一時エラーが返る
      **When** 結果モーダルを開く
      **Then** `投稿詳細の取得に失敗しました` を表示する
      **And** `再試行` ボタンを押すと再取得を実行できる

- [ ] **Given** `judgments` が欠損または空配列のレスポンス
      **When** 結果モーダルを開く
      **Then** クラッシュせず `審査結果はまだありません` を表示する

### 境界値 (Edge Case)
- [ ] **Given** 審査コメントが長文（200文字以上）
      **When** 結果モーダルを開く
      **Then** モーダル内スクロールで全文確認できる
      **And** レイアウト崩れが発生しない

- [ ] **Given** `status=scored` かつ `rank` または `total_count` が欠損
      **When** 結果モーダルを開く
      **Then** `順位情報を取得できませんでした` を表示する

- [ ] **Given** `prefers-reduced-motion` が有効な環境
      **When** 結果モーダルを開閉する
      **Then** アニメーションが無効化される

---

## 🔗 関連資料
- `docs/epics.md`（E15: 審査結果モーダル）
- `docs/screen_design.md`（審査結果/投稿詳細画面）
- `frontend/src/shared/types/domain.ts`
- `frontend/src/shared/hooks/usePost.tsx`
- `frontend/src/features/top/components/MyPostDetail.tsx`

---

**レビュアーへの確認事項:**
- [ ] Issue 1の範囲がE15-01/E15-02/E15-06/E15-07一部に限定されているか
- [ ] `scored` / `failed` / `rank欠損` の表示条件が実装可能な粒度で明確か
- [ ] アクセシビリティ要件（dialog属性、フォーカストラップ、フォーカス復帰）が十分か
- [ ] 非同期取得時の競合（連続クリック、ID切替）に対する要件が十分か
- [ ] 後続Issue（再審査・SNSシェア）への影響を最小化できているか
