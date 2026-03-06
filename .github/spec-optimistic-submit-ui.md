---
name: 仕様策定 (Spec)
about: 新機能や改善の仕様を定義する際に使用 (SDD/TDD/BDD準拠)
title: '[SPEC] 投稿時の楽観的UI実装'
labels: 'spec'
assignees: ''
---

## 📋 概要
投稿ボタン押下時のUX改善。API通信完了を待たずに即座にフィードバックを返し、体感速度を向上させる楽観的UIパターンを実装する。

現在の仕様では、API通信が成功して初めてSEが鳴りモーダルが閉じる。APIサーバーの処理が遅い場合、ユーザーは「ボタンを押しても反応がない」ように感じてしまう問題がある。

---

## 🎯 目的
- **解決する課題**: API遅延時にユーザーが「無反応」と感じるUX問題の解消
- **提供する価値**: 投稿操作に対する即時フィードバックによる体験向上

---

## 📝 詳細仕様

### 機能要件
- バリデーション成功後、API通信を待たずに即座に以下を実行:
  - SE（se_submit）を再生
  - 投稿モーダルを閉じる
  - 審査中画面へ遷移（暫定postIdを使用）
- バックグラウンドでAPI通信を継続
- API成功時：正式postIdを取得し、ポーリングに移行
- API失敗時：審査中画面でエラーを表示し、再投稿ボタンを提供
- 再投稿時：直前の入力値（nickname, body）を復元

### 非機能要件
- ネットワークエラー時もユーザーが迷わないフィードバック
- 二重投稿防止（isSubmittingフラグ維持）
- API失敗時はconsole.errorでエラーログ出力（デバッグ用）
- ページ離脱時は何もしない（投稿データは消失を許容）

### UI/UX設計

#### 正常時フロー
1. 投稿ボタン押下 → 即座にSE再生
2. モーダル閉じる → 審査中画面表示（「審査中...」の通常UI）
3. バックグラウンドでAPI通信
4. API成功 → 正式postIdでポーリング継続
5. 審査完了 → 結果モーダル表示

#### API失敗時フロー
1. 投稿ボタン押下 → 即座にSE再生
2. モーダル閉じる → 審査中画面表示
3. API失敗 → 審査中画面にエラー表示（judgingErrorMessageステート使用）
4. 「再投稿する」ボタン押下 → 投稿モーダル再オープン（入力値復元）

#### エラー表示文言
- ネットワークエラー: 「ネットワークに接続できませんでした」
- タイムアウト: 「通信がタイムアウトしました」
- サーバーエラー（5xx）: 「サーバーエラーが発生しました」
- クライアントエラー（4xx）: 「投稿に失敗しました」
- 汎用: 「投稿に失敗しました」

#### 暫定postIdの生成
- `crypto.randomUUID()` を使用してローカルUUIDを生成
- API成功時に正式postIdで置き換え
- 暫定postIdはポーリング用URL（/judging/{id}）に使用

---

## 🔧 技術仕様

### データモデル (DynamoDB)
N/A（データモデル変更なし）

### API設計
N/A（既存API使用、変更なし）

| 項目 | 値 |
|------|-----|
| Method | POST |
| Path | /posts |
| Request Body | `{ nickname: string, body: string }` |
| Response (成功) | `{ id: string, status: string, ... }` |
| Response (失敗) | `{ error: string, code: string }` |

### AIプロンプト設計
N/A

### 状態管理の変更

#### 追加するステート
```typescript
// 再投稿時の入力値復元用
const [pendingFormData, setPendingFormData] = useState<{ nickname: string; body: string } | null>(null)
```

#### 変更するステート
- `judgingPostId`: 暫定postId（crypto.randomUUID()）→ 正式postId（API成功後）

---

## 🔧 実装詳細

### onSubmit関数 Before/After

#### Before（現状）
```typescript
const onSubmit = async ({ nickname, body }: { nickname: string; body: string }) => {
  if (isSubmitting) return
  // バリデーション...
  setIsSubmitting(true)
  try {
    const response = await api.posts.create({...})  // API待機
    sound.playSe('se_submit')                        // API成功後
    // ...
  } catch (error) {
    setSubmitError(resolveSubmitErrorMessage(error)) // モーダル内にエラー
  } finally {
    setIsSubmitting(false)
  }
}
```

#### After（楽観的UI）
```typescript
const onSubmit = async ({ nickname, body }: { nickname: string; body: string }) => {
  if (isSubmitting) return
  // バリデーション...
  setIsSubmitting(true)

  // 即座にフィードバック
  const tempId = crypto.randomUUID()
  sound.playSe('se_submit')
  setIsPostModalOpen(false)
  enterJudgingMode(tempId, trimmedNickname)

  // バックグラウンドでAPI通信
  try {
    const response = await api.posts.create({...})
    // 正式postIdで状態更新
    setJudgingPostId(response.id)
    syncJudgingPath(response.id)
    if (response.status === 'failed') {
      openResultModal(response.id)
    }
  } catch (error) {
    console.error('Post creation failed:', error)
    setJudgingErrorMessage(resolveSubmitErrorMessage(error))
    setPendingFormData({ nickname: trimmedNickname, body: trimmedBody })
  } finally {
    setIsSubmitting(false)
  }
}
```

---

## 🧪 テスト計画 (TDD)

### Unit Test (Frontend)
- [ ] 正常系: バリデーション成功後、即座にsetIsPostModalOpen(false)が呼ばれる
- [ ] 正常系: バリデーション成功後、即座にsound.playSe('se_submit')が呼ばれる
- [ ] 正常系: バリデーション成功後、即座にenterJudgingModeが呼ばれる
- [ ] 正常系: API成功後、setJudgingPostIdが正式postIdで呼ばれる
- [ ] 異常系: API失敗時、setJudgingErrorMessageが呼ばれる
- [ ] 異常系: API失敗時、setPendingFormDataに入力値が保存される
- [ ] 境界値: isSubmitting=trueの状態で投稿ボタン押下 → 何も起きない
- [ ] 境界値: API通信中にコンポーネントアンマウント → エラーなく完了

### Request Spec (API)
N/A（フロントエンドのみの変更、バックエンドAPI変更なし）

### External Service (WebMock/VCR)
N/A（フロントエンドのみの変更）

### 統合テスト（手動）
- [ ] 通常投稿: 投稿ボタン押下 → 即座にSE/画面遷移 → 審査結果表示
- [ ] API遅延: Network Slow 3G設定で投稿 → 即座にSE/画面遷移 → 待機後 審査結果表示
- [ ] API失敗: サーバー停止状態で投稿 → 即座にSE/画面遷移 → エラー表示 → 再投稿

---

## ✅ 受入条件 (AC) - Given-When-Then

### 正常系 (Happy Path)
- [ ] **Given** 有効な入力値（nickname, body）
      **When** 投稿ボタン押下
      **Then** 即座にSEが鳴り、モーダルが閉じ、審査中画面へ遷移する

- [ ] **Given** 投稿ボタン押下後・API通信中
      **When** API成功
      **Then** 正式なpostIdでポーリングが継続し、審査結果が表示される

### 異常系 (Error Path)
- [ ] **Given** 有効な入力値・API障害中（サーバー停止）
      **When** 投稿ボタン押下
      **Then** 審査中画面でエラーメッセージと「再投稿する」ボタンが表示される

- [ ] **Given** API失敗後のエラー画面
      **When** 「再投稿する」ボタン押下
      **Then** 投稿モーダルが開き、直前の入力値が復元される

- [ ] **Given** API通信中
      **When** ネットワーク切断（offline）
      **Then** 「ネットワークに接続できませんでした」が表示される

### 境界値 (Edge Case)
- [ ] **Given** 投稿ボタン押下直後
      **When** 連打（2回目以降の押下）
      **Then** 2回目以降は無視される（二重投稿防止）

- [ ] **Given** API通信中
      **When** コンポーネントアンマウント（ページ遷移等）
      **Then** メモリリークが発生しない

---

## 🔧 変更ファイル一覧

| ファイル | 変更種別 | 説明 |
|---------|---------|------|
| `frontend/src/App.tsx` | 更新 | onSubmit関数の楽観的UI化、pendingFormData追加 |
| `frontend/src/__tests__/App.optimisticSubmit.test.tsx` | 新規 | 楽観的UIのユニットテスト |

---

## 🔗 関連資料
- 現在の実装: `frontend/src/App.tsx` 567-613行目（onSubmit関数）
- 関連state: isSubmitting, setIsPostModalOpen, enterJudgingMode, setJudgingErrorMessage, judgingPostId
- 関連関数: resolveSubmitErrorMessage, syncJudgingPath

---

**レビュアーへの確認事項:**
- [ ] 仕様の目的が明確か
- [ ] API失敗時のユーザー体験が適切か
- [ ] テスト計画は正常系/異常系/境界値を網羅しているか
- [ ] 受入条件はGiven-When-Then形式で記述されているか
- [ ] 既存機能（審査中ポーリング、結果モーダル）との整合性
- [ ] 暫定postIdの生成・置き換えロジックが適切か
