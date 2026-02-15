---
name: 仕様策定 (Spec)
about: 新機能や改善の仕様を定義する際に使用 (SDD/TDD/BDD準拠)
title: '[SPEC] E11-01 再審査APIの実装'
labels: 'spec'
assignees: ''
---

## 📋 概要

投稿審査システムでは、3人のAI審査員（ひろゆき風/デヴィ婦人風/中尾彬風）が並列で審査を行います。しかし、AI APIの一時的なエラーなどにより審査が失敗する場合があります。審査失敗時のユーザー体験向上のため、失敗した審査員のみを再審査するAPIエンドポイントを実装します。

## 🎯 目的

- 審査失敗時の再試行機能を提供する
- AI APIの一時的エラーに対するリカバリーパスを提供する
- 審査成功判定の再評価（failed → scored）を実現する

---

## 📝 詳細仕様

### 機能要件
- 失敗した審査員のみを再審査するAPIエンドポイントを提供する
- 指定された審査員の審査を再実行し、結果をDynamoDBに上書き保存する
- 全審査員の結果を集計して、ステータス（scored/failed）を再評価する
- 再審査成功時に平均点を再計算する
- 既存の成功審査結果を保持する

### 非機能要件
- JudgePostServiceと同等のタイムアウト・リトライ処理を実装する
- 並列実行のパフォーマンスを維持する
- エラー発生時に適切なログを出力する

### UI/UX設計
- N/A（API専用）

---

## 🔧 技術仕様

### データモデル (DynamoDB)
<!-- 既存のJudgmentテーブルを再利用 -->
| 項目 | 値 |
|------|-----|
| Table | aruaruarena-judgments |
| PK | post_id |
| SK | persona |
| GSI | なし |

### API設計

| 項目 | 値 |
|------|-----|
| Method | POST |
| Path | /api/posts/:id/rejudge |
| Request Body | `{ "failed_personas": ["dewi"] }` |
| Response (成功) | `{ "id": "uuid", "status": "scored" }` |
| Response (失敗) | `{ "error": "...", "code": "..." }` |

### エラーコード定義

| コード | 説明 | ステータスコード |
|------|------|----------------|
| INVALID_STATUS | 投稿がfailed状態ではない | 422 |
| INVALID_PERSONA | 無効な審査員IDが含まれている | 422 |
| NOT_FOUND | 投稿が見つからない | 404 |
| BAD_REQUEST | リクエスト形式が不正 | 400 |

### AIプロンプト設計
- JudgePostServiceの既存プロンプトを再利用

---

## 🧪 テスト計画 (TDD)

### Unit Test (RejudgePostService)
- [ ] 正常系:
  - 指定した1人の審査員の再審査が成功すること
  - 指定した2人の審査員の再審査が成功すること
  - 再審査成功後、statusがscoredに更新されること
  - 平均点が正しく再計算されること（既存の成功審査 + 新規成功審査）
  - 既存の成功審査結果が保持されること
- [ ] 異常系:
  - Postが存在しない場合はWARNログを出力して何もしないこと
  - 無効な審査員IDを指定した場合はエラーとなること
  - 再審査対象の審査員が全員失敗した場合、statusがfailedのまま維持されること
  - 再審査時にAPIエラーが発生した場合、エラーとして記録されること
- [ ] 境界値:
  - 3人全員を再審査対象に指定した場合の動作確認
  - 空の配列を指定した場合の動作確認
  - 既存の審査結果と新規審査結果のスコア計算の境界値確認

### Request Spec (API)
- [ ] `POST /api/posts/:id/rejudge` - 再審査API:
  - Given status=failedの投稿が存在する
  - When POST /api/posts/:id/rejudge で有効なfailed_personasを送信
  - Then ステータスコード200で投稿情報を返す
- [ ] `POST /api/posts/:id/rejudge` - dewiのみ再審査:
  - Given dewiのみが失敗している投稿が存在する
  - When dewiのみを再審査対象に指定
  - Then dewiの審査結果が上書き保存され、statusがscoredになる
- [ ] `POST /api/posts/:id/rejudge` - 存在しない投稿:
  - Given 存在しない投稿ID
  - When POST /api/posts/:id/rejudge を実行
  - Then 404エラーを返す
- [ ] `POST /api/posts/:id/rejudge` - 不正なステータス:
  - Given status=scoredの投稿が存在する
  - When POST /api/posts/:id/rejudge を実行
  - Then 422エラーを返す（INVALID_STATUS）
- [ ] `POST /api/posts/:id/rejudge` - 無効な審査員ID:
  - Given 無効な審査員IDを含むリクエスト
  - When POST /api/posts/:id/rejudge を実行
  - Then 422エラーを返す（INVALID_PERSONA）
- [ ] `POST /api/posts/:id/rejudge` - 不正なリクエストボディ:
  - Given リクエストボディが不正
  - When POST /api/posts/:id/rejudge を実行
  - Then 400エラーを返す

### External Service (WebMock/VCR)
- [ ] モック対象:
  - GeminiAdapter#judge
  - DewiAdapter#judge
  - OpenAiAdapter#judge

---

## ✅ 受入条件 (AC) - Given-When-Then

### 正常系 (Happy Path)
- [ ] **Given** status=failed、dewiのみ審査失敗の投稿が存在する
      **When** POST /api/posts/:id/rejudge で `{ "failed_personas": ["dewi"] }` を送信
      **Then** dewiの審査が成功し、statusがscoredに更新される
      **And** 平均点が再計算される

- [ ] **Given** status=failed、dewiとnakao審査失敗の投稿が存在する
      **When** POST /api/posts/:id/rejudge で `{ "failed_personas": ["dewi", "nakao"] }` を送信
      **Then** 両方の審査が成功し、statusがscoredに更新される

### 異常系 (Error Path)
- [ ] **Given** 存在しない投稿ID
      **When** POST /api/posts/:id/rejudge を実行
      **Then** 404エラーとエラーコード"NOT_FOUND"を返す

- [ ] **Given** status=scoredの投稿が存在する
      **When** POST /api/posts/:id/rejudge を実行
      **Then** 422エラーとエラーコード"INVALID_STATUS"を返す

- [ ] **Given** 無効な審査員ID "invalid" を含むリクエスト
      **When** POST /api/posts/:id/rejudge を実行
      **Then** 422エラーとエラーコード"INVALID_PERSONA"を返す

- [ ] **Given** 再審査時に全ての審査員が失敗する投稿が存在する
      **When** POST /api/posts/:id/rejudge を実行
      **Then** statusがfailedのまま維持される

### 境界値 (Edge Case)
- [ ] **Given** failed_personasが空配列
      **When** POST /api/posts/:id/rejudge を実行
      **Then** 422エラーを返す

- [ ] **Given** 3人全員を再審査対象に指定した投稿が存在する
      **When** POST /api/posts/:id/rejudge を実行
      **Then** 全員の審査が成功し、statusがscoredに更新される

---

## 🔗 関連資料
- `docs/epics.md` - E11: 再審査API の概要
- `backend/app/services/judge_post_service.rb` - 既存の審査サービス
- `backend/app/models/judgment.rb` - Judgmentモデル
- `backend/app/models/post.rb` - Postモデル

---

**レビュアーへの確認事項:**
- [ ] 仕様の目的が明確か
- [ ] DynamoDBのキー設計はアクセスパターンに適しているか
- [ ] テスト計画は正常系/異常系/境界値を網羅しているか
- [ ] 受入条件はGiven-When-Then形式で記述されているか
- [ ] 既存機能や他の仕様と矛盾していないか
