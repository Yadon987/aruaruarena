---
name: 仕様策定 (Spec)
about: 新機能や改善の仕様を定義する際に使用 (SDD/TDD/BDD準拠)
title: '[SPEC] E16-01〜E16-04: 自分の投稿一覧（フロントエンド）'
labels: 'spec, E16, frontend'
assignees: ''
---

## 📋 概要
E16「自分の投稿一覧（フロントエンド）」として、トップ画面から開ける投稿一覧モーダルを実装する。投稿IDは `localStorage` の `my_post_ids` から取得し、投稿詳細は既存API（`GET /api/posts/:id`）で補完表示する。

## 🎯 目的
- 自分が投稿した内容を後から参照できる導線を提供する
- 投稿一覧から審査結果モーダルへ遷移できるようにし、再閲覧体験を改善する
- `localStorage` の不正値や欠損値があっても安全に表示できる

---

## 📝 詳細仕様

### 機能要件
- フッターの `自分の投稿一覧` ボタンでモーダルを開く
- モーダルには以下を表示する
  - タイトル `自分の投稿`
  - 投稿リスト（最大20件）
  - 空状態メッセージ（`投稿はまだありません`）
  - 閉じるボタン
- `my_post_ids` の配列順を表示順とし、先頭を最新投稿として扱う
- 投稿リスト生成は以下の順序で正規化する
  - `my_post_ids` を読み込む（不正JSON・配列以外は空配列）
  - UUID形式（`[0-9a-fA-F-]{36}`）以外を除外
  - 重複を除外（先に出現したIDを優先）
  - 先頭20件に切り詰め
  - 正規化後の配列を `my_post_ids` へ保存
- 旧キー `aruaruarena_my_posts` が存在し `my_post_ids` が空の場合は移行する
- 一覧表示時、正規化済みIDに対して `GET /api/posts/:id` を同時3件まで並列取得する
- 詳細行は取得完了した投稿から順次描画し、未取得行は `読み込み中...` を表示する
- 各行は以下の項目を表示する
  - 本文
  - 平均点
  - 順位
  - 作成日時
  - 審査ステータス（`judging` / `scored` / `failed`）
- 投稿行クリック時は以下を実施する
  - 投稿一覧モーダルを閉じる
  - 対象投稿の結果モーダルを開く
- 詳細取得で `404` の場合は該当IDを `my_post_ids` から削除する
- 詳細取得で `404` 以外の失敗は `my_post_ids` を変更しない
- 取得失敗行は `投稿詳細の取得に失敗しました` と `再試行` を表示し、再クリックで再取得できる
- 同一ID連打時はAPIリクエストを1回に抑止する
- モーダルは `Esc` / 閉じるボタン / 背景クリックで閉じる
- キーボード操作として `Enter` / `Space` で `自分の投稿一覧` ボタンを開ける
- アクセシビリティ
  - モーダルに `role="dialog"` と `aria-modal="true"` を設定
  - モーダル表示時の初期フォーカスは閉じるボタン
  - モーダルを閉じたらトリガーボタンへフォーカスを戻す

### 非機能要件
- モーダル表示中は背景スクロールをロックする
- 投稿20件表示時でもモバイル幅でレイアウト崩れしない
- 連続クリック時に競合で誤投稿の結果を表示しない
- API失敗時はユーザー文言を表示し、コンソールに障害解析可能なログを残す
- 計測条件（`npm run dev` / Chrome / キャッシュなし初回表示）で、モーダル表示から一覧初回描画まで500ms以内

### UI/UX設計
- 画面種別: モーダル
- PC: 画面中央の固定幅カード
- SP: 画面高さに応じてモーダル内部を縦スクロール
- ローディング中は `読み込み中...` を表示
- エラー時文言
  - `NOT_FOUND`: `投稿が見つかりません`
  - それ以外: `投稿詳細の取得に失敗しました`

---

## 🔧 技術仕様

### データモデル (DynamoDB)
| 項目 | 値 |
|------|-----|
| Table | 既存 `posts`（新規テーブル追加なし） |
| PK | `id` |
| SK | なし |
| GSI | 追加なし |

### API設計
| 項目 | 値 |
|------|-----|
| Method | GET |
| Path | /api/posts/:id |
| Request Body | なし |
| Response (成功) | `{ id, body, nickname, status, average_score, rank, total_count, created_at, judgments }` |
| Response (失敗) | `{ error: "...", code: "..." }` |

### AIプロンプト設計
- N/A（フロントエンド表示機能のみ）

### 実装対象ファイル
- `frontend/src/App.tsx`
- `frontend/src/features/top/components/MyPostsModal.tsx`（新規）
- `frontend/src/features/top/hooks/useMyPostIds.ts`（新規）
- `frontend/src/features/top/hooks/useMyPostsDetail.ts`（新規）
- `frontend/src/features/top/__tests__/MyPostStorage.red.test.tsx`
- `frontend/src/features/top/__tests__/MyPostDetail.integration.test.tsx`
- `frontend/e2e/top-page-my-post-highlight.red.spec.ts`

---

## 🧪 テスト計画 (TDD)

### Unit Test (Model/Service)
- [ ] 正常系:
  - `my_post_ids` から最大20件を表示する
  - 重複IDを除外して表示する
  - UUID以外を除外して `my_post_ids` を正規化保存する
  - 投稿クリックで結果モーダルが開く
- [ ] 異常系:
  - `my_post_ids` が不正JSONでもクラッシュしない
  - 404取得時に該当IDを `my_post_ids` から削除する
  - 500取得時は `my_post_ids` を保持する
  - 失敗行で `再試行` を押すと再取得できる
- [ ] 境界値:
  - `my_post_ids` が空配列で空状態メッセージを表示する
  - 同一IDを短時間に連打しても1リクエストのみ発行する
  - 21件以上で20件へ切り詰める

### Request Spec (API)
- [ ] `GET /api/posts/:id` - N/A（既存API利用のみ）

### External Service (WebMock/VCR)
- [ ] モック対象:
  - MSWで `GET /api/posts/:id` の `200` / `404` / `500` をモック

### E2E Test (Playwright)
- [ ] `自分の投稿一覧` ボタンをクリックしてモーダルを開ける
- [ ] `Enter` / `Space` でモーダルを開ける
- [ ] `Esc` でモーダルを閉じ、トリガーへフォーカス復帰する
- [ ] 投稿行クリックで結果モーダルへ遷移する
- [ ] 取得失敗行で再試行操作が機能する

---

## ✅ 受入条件 (AC) - Given-When-Then

### 正常系 (Happy Path)
- [ ] **Given** `my_post_ids` に存在する投稿IDが保存されている
      **When** `自分の投稿一覧` モーダルを開く
      **Then** 投稿一覧が表示される
      **And** 各投稿で本文・平均点・順位・作成日時・ステータスを確認できる

- [ ] **Given** 投稿一覧モーダルが開いている
      **When** 任意の投稿をクリックする
      **Then** 投稿一覧モーダルが閉じる
      **And** 対象投稿の審査結果モーダルが開く

### 異常系 (Error Path)
- [ ] **Given** `my_post_ids` が不正JSONで保存されている
      **When** `自分の投稿一覧` モーダルを開く
      **Then** クラッシュせず空状態メッセージを表示する

- [ ] **Given** 投稿詳細APIが `404` を返す投稿IDが `my_post_ids` に含まれる
      **When** その投稿をクリックする
      **Then** `投稿が見つかりません` を表示する
      **And** 該当IDを `my_post_ids` から削除する

- [ ] **Given** 投稿詳細APIが `500` を返す投稿IDが `my_post_ids` に含まれる
      **When** その投稿をクリックする
      **Then** `投稿詳細の取得に失敗しました` を表示する
      **And** `my_post_ids` の内容は変更しない

### 境界値 (Edge Case)
- [ ] **Given** `my_post_ids` に21件以上保存されている
      **When** `自分の投稿一覧` モーダルを開く
      **Then** 表示件数は20件以内になる

- [ ] **Given** 同じ投稿を短時間で複数回クリックする
      **When** 詳細取得中に追加クリックする
      **Then** 二重リクエストを発生させない

- [ ] **Given** `my_post_ids` にUUID形式でないIDが含まれる
      **When** `自分の投稿一覧` モーダルを開く
      **Then** 不正IDを除外して描画する
      **And** 除外後の配列を `my_post_ids` に保存する

---

## 🔗 関連資料
- `docs/epics.md`（E16: 自分の投稿一覧）
- `docs/screen_design.md`（4. 自分の投稿一覧画面）
- `frontend/src/App.tsx`
- `frontend/src/shared/services/api.ts`

---

**レビュアーへの確認事項:**
- [ ] `my_post_ids` 正規化（UUID検証・重複除外・20件上限）の順序が明確か
- [ ] 404時削除/404以外保持の仕様が実装可能な粒度か
- [ ] 一覧表示と結果モーダル遷移の責務分割が明確か
- [ ] モーダル開閉のアクセシビリティ（role, aria-modal, フォーカス復帰）が十分か
- [ ] E2Eテストで主要導線と失敗導線を網羅できているか
