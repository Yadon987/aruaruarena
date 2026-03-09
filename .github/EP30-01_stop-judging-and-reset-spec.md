# [SPEC] EP30-01 審査中断してホームへ戻る導線の追加（完全版）

## 📋 概要
審査中画面に「審査を停止してホームに戻る」導線を追加する。
中止時はトップ画面へ遷移し、審査フローに紐づく一時投稿データを初期化して、遅延レスポンスによる画面巻き戻りを防ぐ。

## 🎯 目的
- ユーザーが審査待ちを任意で中断できるようにする
- 中断後に `judging` へ戻る競合不具合を防ぐ
- 細いスマホでも誤タップしにくい位置に停止導線を提供する
- 「トップへ戻った後の初期状態」を明確に保証する

---

## 📝 詳細仕様

### 機能要件
- 停止ボタン表示条件
  - `viewMode === 'judging'` のときのみ左上に表示
  - `viewMode === 'top'` では非表示
- 停止ボタン押下時
  - 停止確認ダイアログを開く（誤操作防止）
  - `キャンセル` で状態不変
  - `中止する` で停止処理実行
- 停止処理（中止確定時）
  - `clearJudgingPolling()` 実行（interval停止 + polling fetch abort）
  - 投稿作成 `POST /posts` の in-flight リクエストを abort
  - 審査セッション世代（generation）をインクリメントし、旧レスポンス反映を無効化
  - 画面遷移: `setViewMode('top')` + `syncTopPath()`
  - 一時状態初期化:
    - `judgingPostId = ''`
    - `isJudgingPollingReady = false`
    - `judgingErrorMessage = ''`
    - `pendingFormData = null`
    - `isSubmitting = false`
    - `submitError = ''`
    - `successMessage = ''`
    - `isPostModalOpen = false`
- 初期化対象外（保持するもの）
  - `my_post_ids`（投稿履歴）
  - 既存ランキング/結果キャッシュ
  - 音声ミュート設定
- 競合防止
  - 停止後に `POST /posts` 成功応答が返っても `applyJudgingSubmitSuccess` を無効化
  - 停止後に `GET /posts/:id` 応答が返っても `judging` 再遷移/結果モーダル自動表示を無効化

### 非機能要件
- レイヤー優先度を固定
  - 既存モーダル: `z-50`
  - 停止確認ダイアログ: `z-[45]`
  - 下部ドック（審査員席/ボタン）: `z-40`
- 停止確定後、体感即時（100ms以内）でトップへ遷移
- 予期しない例外があってもトップ遷移は継続（フェイルセーフ）
- Abort・競合による想定内中断はユーザーエラー表示しない

### UI/UX設計
- 停止ボタン
  - 位置: 画面左上固定（右上の投稿/音声と対称）
  - 文言: `審査を停止して戻る`
  - `aria-label`: `審査を停止してホームに戻る`
- 停止確認ダイアログ
  - タイトル: `審査を中止しますか？`
  - 本文: `中止するとトップ画面に戻り、審査中の投稿データは初期化されます。`
  - ボタン: `キャンセル` / `中止する`
  - Escapeで閉じる
  - フォーカストラップ有効
- 遷移後
  - トップ画面の通常導線（投稿する/ランキング/その他）が操作可能
  - 審査中専用エラーパネルは非表示

---

## 🔧 技術仕様

### データモデル (DynamoDB)
| 項目 | 値 |
|------|-----|
| Table | N/A（フロントエンド状態制御のみ） |
| PK | N/A |
| SK | N/A |
| GSI | N/A |

補足:
- 既存の `posts` テーブルアクセスパターンに変更なし
- DynamoDBのスキーマ追加・更新なし

### API設計
| 項目 | 値 |
|------|-----|
| Method | 既存 `POST /posts`, `GET /posts/:id` を継続利用 |
| Path | 追加APIなし |
| Request Body | 変更なし |
| Response (成功) | 変更なし |
| Response (失敗) | 変更なし |

実装詳細:
- `api.posts.create(data, options?)` に `signal` を受けられる拡張を追加
- `App.tsx` に `submitAbortControllerRef` を追加し、中止時に `abort()`
- `submissionGenerationRef` を追加し、非同期完了時に世代一致チェック

非対象（別Issue候補）:
- サーバー側AI審査そのものの停止API（例: `POST /posts/:id/cancel`）
  - 本仕様で停止するのはフロント監視・画面遷移のみ

### AIプロンプト設計
- N/A（プロンプト変更なし）

---

## 🧪 テスト計画 (TDD)

### Unit Test (Model/Service)
- [ ] 正常系: 停止処理関数が指定状態を初期値へ戻す
- [ ] 異常系: create abort時に `ABORTED` を握りつぶしてトップ維持
- [ ] 境界値: 停止連打でも状態不整合が起きない

### Request Spec (API)
- [ ] N/A（Rails API変更なし）

### External Service (WebMock/VCR)
- [ ] N/A

### Frontend Integration / Component
- [ ] `viewMode=judging` で停止ボタンが表示される
- [ ] `viewMode=top` で停止ボタンが表示されない
- [ ] 停止確認ダイアログの開閉（click, Escape, 背景クリック）
- [ ] `キャンセル` で審査継続
- [ ] `中止する` でトップ遷移 + `/` 復帰
- [ ] 停止後に遅延 `POST /posts` 成功応答が返っても `judging` へ戻らない
- [ ] 停止後に遅延 `GET /posts/:id` 応答が返っても結果モーダルを勝手に開かない
- [ ] 停止後に審査中の発話・ルーレット演出が継続しない
- [ ] レイヤー順序（`z-50 > z-[45] > z-40`）で操作阻害がない

---

## ✅ 受入条件 (AC) - Given-When-Then

### 正常系 (Happy Path)
- [ ] **Given** ユーザーが審査中画面にいる
      **When** 左上の停止ボタンを押し「中止する」を選ぶ
      **Then** 審査ポーリング/進行中投稿リクエストが停止し、トップへ遷移し、一時投稿データが初期化される

- [ ] **Given** ユーザーが審査中画面にいる
      **When** 停止確認で「キャンセル」を選ぶ
      **Then** 画面と審査状態は変化しない

### 異常系 (Error Path)
- [ ] **Given** 停止処理と同時に create成功レスポンスが返る
      **When** 停止処理済み世代と不一致のレスポンスを受信する
      **Then** そのレスポンスは破棄され、`judging` に再遷移しない

- [ ] **Given** 停止時に AbortError が発生する
      **When** 例外ハンドリングが実行される
      **Then** ユーザーに不要なエラーを出さずトップ画面に留まる

### 境界値 (Edge Case)
- [ ] **Given** 停止ボタンを短時間で複数回押す
      **When** 停止処理が多重発火する
      **Then** 最終状態は1回分の停止結果に収束し、例外や不整合が発生しない

- [ ] **Given** `/judging/:id` へ直接アクセスして審査中画面を表示している
      **When** 停止してトップへ戻る
      **Then** URLは `/` に復帰し、ブラウザ戻るで審査が再開されない

---

## 🔗 関連資料
- `frontend/src/App.tsx`
- `frontend/src/shared/services/api.ts`
- `frontend/src/features/judging/components/JudgeAvatars.tsx`
- `.github/ISSUE_TEMPLATE/spec.md`
- `.github/ISSUE_TEMPLATE/Issue_review.md`

---

**レビュアーへの確認事項:**
- [ ] 「投稿データ初期化」の対象範囲（保持/破棄）が明確か
- [ ] Abort + generation の競合対策が実装可能な粒度で定義されているか
- [ ] レイヤー優先度の定義でモーダル操作を阻害しないか
- [ ] サーバーAI審査停止が非対象であることが明確か
- [ ] 既存導線（結果モーダル、ランキング、その他）と矛盾しないか
