## 📋 概要
E15「審査結果モーダル（フロントエンド）」の推奨Issue分割2つ目として、アクションボタン機能（再審査・SNSシェア・OGP画像プレビュー）を実装する。  
対象は `ResultModal` 内のユーザー操作導線であり、表示条件と押下時挙動を明確化する。

## 🎯 目的
- 失敗投稿に対して再審査導線を提供し、再挑戦体験を改善する
- 成功投稿に対してSNSシェア導線を提供し、拡散を促進する
- シェア前にOGPプレビューを表示し、投稿内容の確認性を高める

---

## 📝 詳細仕様

### 機能要件
- `status=failed` のときのみ「再審査」ボタンを表示する
- `status=scored` かつ `rank<=20` のときのみ「SNSシェア」ボタンを有効化する
- 再審査ボタン押下時に再審査APIを呼び、成功時は `judging` へ遷移する
- SNSシェア押下時にX向けシェアURLを `encodeURIComponent` で生成し、新規タブを `noopener,noreferrer` 付きで開く
- シェアURL生成前にOGP画像のプレビューを表示する
- APIエラー時は `{ error, code }` をユーザー向け文言へ変換してモーダル内に表示する
- `ogp_image_url` 欠損時はプレースホルダー画像でプレビューし、シェア操作は継続可能とする
- 通信中にモーダルを閉じた場合はレスポンス反映を破棄し、再オープン時に最新状態で再取得する

### 非機能要件
- ボタン押下中はローディング状態を表示し、二重送信を防止する
- API失敗時にフロントエンドログへ `post_id`, `action`, `error_code`, `http_status`, `trace_id`（存在時）を出力する
- モバイル幅（375px）でボタンレイアウトが崩れない
- モーダル表示時は先頭操作要素にフォーカスし、`Esc` で閉じられる
- エラー領域は `aria-live="polite"` とし、読み上げで検知可能にする

### UI/UX設計
- 再審査ボタンは注意喚起のためセカンダリ色で表示する
- SNSシェアボタンは `status=scored` かつ `rank<=20` で活性表示し、それ以外は非表示にする
- OGPプレビューはサムネイル、投稿本文、平均点、順位を表示する
- エラー文言マッピング例:
  - `rate_limited`: 時間をおいて再度お試しください
  - `not_found`: 投稿が見つかりません
  - `conflict`: 既に再審査処理中です
  - `internal_error`/`timeout`: 通信に失敗しました。再度お試しください

---

## 🔧 技術仕様

### データモデル (DynamoDB)
| 項目 | 値 |
|------|-----|
| Table | N/A（本IssueでDB変更なし。E07/E11の既存レスポンスを利用） |
| PK | N/A |
| SK | N/A |
| GSI | N/A |

### API設計
| 項目 | 値 |
|------|-----|
| Method | POST |
| Path | `/api/posts/:id/rejudge` |
| Request Body | なし |
| Response (成功) | `{ id: "uuid", status: "judging" }` |
| Response (失敗) | `{ error: "message", code: "rate_limited｜not_found｜conflict｜internal_error｜timeout" }` |

| 項目 | 値 |
|------|-----|
| Method | GET |
| Path | `/api/posts/:id` |
| Request Body | なし |
| Response (成功) | 投稿詳細（status, score, rank, judgments, ogp_image_url） |
| Response (失敗) | `{ error: "message", code: "error_code" }` |

### AIプロンプト設計
- N/A（フロントエンド実装のみ）

---

## 🧪 テスト計画 (TDD)

### Unit Test (Model/Service)
- [ ] 正常系: ステータスごとのボタン表示制御が正しい
- [ ] 正常系: `status=scored` かつ `rank<=20` でのみシェア導線が表示される
- [ ] 異常系: 再審査API失敗（404/409/429/500/timeout）時に文言が正しく表示される
- [ ] 境界値: `rank=20` と `rank=21` でシェア可否が正しく切り替わる
- [ ] 境界値: `ogp_image_url=nil` でもプレビュー表示とシェア操作が継続できる
- [ ] 並行操作: 再審査ボタン連打時にAPI呼び出しが1回に抑制される
- [ ] アクセシビリティ: モーダル初期フォーカスと `Esc` クローズが機能する

### Request Spec (API)
- [ ] `N/A`（本IssueでバックエンドAPIは実装しない）

### External Service (WebMock/VCR)
- [ ] モック対象: N/A（MSWでAPIレスポンスをモック）

---

## ✅ 受入条件 (AC) - Given-When-Then

### 正常系 (Happy Path)
- [ ] **Given** `status=failed` の投稿詳細が表示されている  
      **When** ユーザーが「再審査」ボタンを押下する  
      **Then** `/api/posts/:id/rejudge` が1回呼ばれ、画面が審査中状態に遷移する
- [ ] **Given** `status=scored` かつ `rank<=20` の投稿詳細が表示されている  
      **When** ユーザーが「SNSシェア」ボタンを押下する  
      **Then** OGPプレビュー表示後にXシェアURLが新規タブで開く

### 異常系 (Error Path)
- [ ] **Given** `status=failed` の投稿詳細が表示されている  
      **When** 再審査APIが500エラーを返す  
      **Then** エラーメッセージが表示され、再審査ボタンが再び押下可能になる
- [ ] **Given** `status=failed` の投稿詳細が表示されている  
      **When** 再審査APIが409エラーを返す  
      **Then** 「既に再審査処理中」の文言を表示し、追加リクエストは送信しない
- [ ] **Given** 通信中にモーダルが閉じられている  
      **When** 遅延レスポンスが返る  
      **Then** 画面状態を更新せず、再オープン時に最新データを取得する

### 境界値 (Edge Case)
- [ ] **Given** `status=scored` かつ `rank=20` の投稿詳細が表示されている  
      **When** モーダルが表示される  
      **Then** SNSシェアボタンが表示される
- [ ] **Given** `status=scored` かつ `rank=21` の投稿詳細が表示されている  
      **When** モーダルが表示される  
      **Then** SNSシェアボタンが非表示になる
- [ ] **Given** `status=scored` かつ `rank<=20` だが `ogp_image_url` が空の投稿詳細が表示されている  
      **When** ユーザーが「SNSシェア」ボタンを押下する  
      **Then** プレースホルダー付きプレビューを表示し、シェア操作を継続できる

---

## 🔗 関連資料
- `docs/epics.md`（E15 推奨Issue分割）
- `docs/screen_design.md`
- `frontend/src/components/ResultModal.tsx`
- `frontend/src/components/JudgeDetail.tsx`
- `frontend/src/types/api.ts`

---

**レビュアーへの確認事項:**
- [ ] 仕様の目的が明確か
- [ ] DynamoDBのキー設計はアクセスパターンに適しているか（N/Aの妥当性）
- [ ] テスト計画は正常系/異常系/境界値を網羅しているか
- [ ] 受入条件はGiven-When-Then形式で記述されているか
- [ ] 既存機能や他の仕様と矛盾していないか
