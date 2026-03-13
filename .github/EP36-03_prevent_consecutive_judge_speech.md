# [SPEC] アバター連続発言防止機能（完全版）

## 📋 概要
審査員アバターが、同じキャラクターで連続して発言してしまう問題を解決する。
現在は直前の**フレーズ**の重複は防止しているが、**直前の審査員**が連続して発言することは防止されていない。

## 🎯 目的
- ユーザー体験の向上：同じ審査員が連続発言することによる単調さを解消
- 審査員の個性を際立たせる：3人がまんべんなく発言するようにする
- 既存パターンとの整合性維持：`lastSpeechRef`（フレーズ重複防止）と同様のアプローチ

---

## 📝 詳細仕様

### 機能要件
- 連続発言防止の定義
  - ある審査員の発話完了後、次の発話者は直前の発言者と異なる審査員を選択する
  - 「発話中」の重複は既に `speakingJudge: JudgePersona | null` で防止済み
- 対象範囲
  - `isJudging === true` の審査中アイドル発言
  - `allowIdleSpeech === true` のアイドル時発言
- 審査員数が1人以下の場合
  - `JUDGES.length === 1` の場合、回避不可のため連続発言を許容する
  - `JUDGES.length === 0` の場合、既存のエラー処理に従う

### 非機能要件
- パフォーマンス影響：無視できる（配列フィルタリングのみ）
- 既存の発話タイミング（`INTERVAL_MIN_MS: 0` 〜 `INTERVAL_MAX_MS: 500`）に変更なし

### UI/UX設計
- ユーザーから見える変化：審査員が順番に発言するように見える
- 明示的なUI変更なし

---

## 🔧 技術仕様

### データモデル (DynamoDB)
| 項目 | 値 |
|------|-----|
| Table | N/A（フロントエンド状態制御のみ） |
| PK | N/A |
| SK | N/A |
| GSI | N/A |

### API設計
| 項目 | 値 |
|------|-----|
| Method | N/A（変更なし） |
| Path | N/A |

### 修正ファイル
- `frontend/src/shared/hooks/useJudgeSpeech.ts`

### 変更内容

1. **直前の審査員を記録するrefを追加**（37行目付近）
   ```typescript
   const lastSpeakingJudgeRef = useRef<JudgePersona | null>(null)
   ```

2. **getRandomJudge() を修正**（59-65行目） - 直前の審査員を除外するロジックを追加
   ```typescript
   const getRandomJudge = useCallback((): JudgePersona => {
     if (JUDGES.length === 0) {
       throw new Error('No judges configured')
     }
     const availableJudges = JUDGES.filter((judge) => judge !== lastSpeakingJudgeRef.current)
     const pool = availableJudges.length > 0 ? availableJudges : JUDGES
     const index = Math.floor(Math.random() * pool.length)
     const selectedJudge = pool[index]
     lastSpeakingJudgeRef.current = selectedJudge
     return selectedJudge
   }, [])
   ```

3. **リセット処理に lastSpeakingJudgeRef を追加**（107行目付近）
   ```typescript
   lastSpeakingJudgeRef.current = null
   ```

### 既存パターンとの整合性
- `lastSpeechRef`（フレーズ重複防止）と同じパターンを使用
- コードの一貫性を維持

---

## 🧪 テスト計画 (TDD)

### Unit Test (Hooks)
- [ ] 正常系: 3人の審査員がいる場合、直前の発言者と異なる審査員が選ばれる
- [ ] 境界値: 審査員が1人の場合、同じ審査員が選ばれる（回避不可）
- [ ] 境界値: 審査員が2人の場合、交互に選ばれる
- [ ] リセット: `isPostModalOpen` で `lastSpeakingJudgeRef` がリセットされる
- [ ] リセット: `!isJudging && !allowIdleSpeech` で `lastSpeakingJudgeRef` がリセットされる

### Frontend Integration
- [ ] 審査中に同じ審査員が連続して発言しない
- [ ] アイドル発言でも同じ審査員が連続して発言しない

---

## ✅ 受入条件 (AC) - Given-When-Then

### 正常系 (Happy Path)
- [ ] **Given** 3人の審査員がいる
      **When** ひろゆきが発言を完了する
      **Then** 次の発言者は「デヴィ」または「中尾」になる

- [ ] **Given** 3人の審査員がいる
      **When** 審査員が5回連続で発言する
      **Then** 同じ審査員が連続して発言することはない

### 境界値 (Edge Case)
- [ ] **Given** 審査員が1人のみ設定されている
      **When** 発言者を選択する
      **Then** 同じ審査員が選ばれる（回避不可のため許容）

- [ ] **Given** 審査中モードから終了する
      **When** `isJudging` が `false` になる
      **Then** `lastSpeakingJudgeRef` がリセットされる

---

## 🔗 関連資料
- `frontend/src/shared/hooks/useJudgeSpeech.ts`
- `frontend/src/shared/constants/animations.ts`
- `frontend/src/shared/constants/judgePhrases.ts`

---

**レビュアーへの確認事項:**
- [ ] 連続発言防止の適用範囲（審査中のみ/アイドル時も含む）が適切か
- [ ] 審査員1人のケースの挙動（連続発言許容）で問題ないか
- [ ] 既存のテストファイルへの追加場所が適切か
