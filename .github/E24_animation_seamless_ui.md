---
name: 仕様策定 (Spec)
about: 新機能や改善の仕様を定義する際に使用 (SDD/TDD/BDD準拠)
title: '[SPEC] E24 審査員アニメーション・シームレスUI実装'
labels: 'spec, frontend, animation'
assignees: ''
---

## 📋 概要

現在の審査画面は縦並びの静的なレイアウトで、投稿後に画面遷移が発生する。これを**シームレスで没入感のあるUI**に刷新し、審査員キャラクターの**登場アニメーション・待機アニメーション（呼吸）・口癖発話**を実装する。

## 🎯 目的

- **没入感の向上**: 審査員が常に背景に存在し、投稿フォームのみモーダルで表示
- **キャラクターの魅力向上**: 各審査員の個性的な登場・呼吸アニメーション
- **UX改善**: 画面遷移をなくし、モーダル開閉のみでシームレスな体験を提供

---

## 📝 詳細仕様

### 機能要件

- **FR-01**: 審査員3名が常に背景に表示される（viewModeに関係なく）
- **FR-02**: 初回アクセス時、審査員が各キャラクター固有の登場アニメーションで表示（3人同時開始）
- **FR-03**: 登場完了後（**中尾彬風の1.2s完了後**）、審査員が呼吸アニメーションで待機
- **FR-04**: 投稿フォームがモーダルとして手前に表示される（背景は `bg-black/60` で透過）
- **FR-05**: 投稿完了時、モーダルが閉じ審査員が口癖発話を開始
- **FR-06**: 口癖発話時、該当審査員が口パクアニメーションと吹き出しを表示
- **FR-07**: 審査中の投稿内容（ニックネーム・本文）が画面に表示される
- **FR-08**: 審査完了時、結果モーダルが表示され、審査員は待機状態に戻る（口癖停止）
- **FR-09**: モーダルオープン中は口癖表示を停止する（`isJudging && !isPostModalOpen`）
- **FR-10**: 同一審査員の連続選択は許容するが、**同じセリフは連続しない**よう制御

### 非機能要件

- **NFR-01**: prefers-reduced-motion設定時は全アニメーションを無効化
- **NFR-02**: 初回レンダリング時にアバター画像9枚をプリロード
- **NFR-03**: アニメーションによるタイマーのメモリリークを防止
- **NFR-04**: スクリーンリーダーで口癖が読み上げられる（aria-live="polite"）
- **NFR-05**: スマホ幅（375px）でもレイアウトが崩れない
- **NFR-06**: GPUアクセラレーション有効化（framer-motionのデフォルト動作）
- **NFR-07**: 低スペック端末でも60fps維持を目指す

### UI/UX設計

#### 新しいUIフロー

```
初期状態
┌─────────────────────────────────────────┐
│  Header + SoundButton                    │
├─────────────────────────────────────────┤
│                                         │
│    [中尾彬]  [ひろゆき]  [デヴィ夫人]    │  ← 背景レイヤー（常に表示）
│      ↑          ↑           ↑           │    登場アニメーション → 呼吸
│    スライド   バウンド    スライド       │
│                                         │
├─────────────────────────────────────────┤
│  RankingSection                          │  ← 手前レイヤー（z-10）
│  [投稿する] ボタン                       │
│  Footer                                  │
└─────────────────────────────────────────┘

投稿モーダル表示時（口癖停止中）
┌─────────────────────────────────────────┐
│  ┌─────────────────────────────────┐    │
│  │  投稿フォーム（モーダル）        │    │  ← z-50, bg-black/60
│  │  ニックネーム: [          ]     │    │
│  │  あるある:   [          ]       │    │
│  │  [投稿] [キャンセル]            │    │
│  └─────────────────────────────────┘    │
│    [中尾彬]  [ひろゆき]  [デヴィ夫人]    │  ← 背景は透けて見える
└─────────────────────────────────────────┘

審査中（口癖表示中）
┌─────────────────────────────────────────┐
│  審査中: ニックネーム「投稿内容...」     │
│    [中尾彬]  [ひろゆき]  [デヴィ夫人]    │
│                  💬 それってあなたの     │  ← 吹き出し + 口パク
│                      感想ですよね        │
│  AI審査員が採点中...                     │
└─────────────────────────────────────────┘
```

#### 登場アニメーション仕様（3人同時開始）

| 審査員 | 方向 | イージング | 所要時間 | 特徴 |
|--------|------|-----------|---------|------|
| ひろゆき風 | 下から斜め | spring (bounce: 0.4) | 0.8s | デスクから「ぬっ」と現れるバウンド |
| デヴィ夫人風 | 右から | easeOut | 1.0s | 優雅で等速的なスライド |
| 中尾彬風 | 左から | cubic-bezier | **1.2s** | 重厚感のあるスライド（**最遅**) |

**登場完了判定**: 中尾彬風のアニメーション完了（1.2s）を待ってから呼吸アニメーション開始

#### 待機アニメーション（呼吸）仕様

| 審査員 | 周期 | 振幅 | 特徴 |
|--------|------|------|------|
| ひろゆき風 | 2.0s | scale: 1.02 | 小刻みで浅い呼吸 |
| デヴィ夫人風 | 4.0s | scale: 1.05, y: -3px | ゆったりとした深い呼吸 |
| 中尾彬風 | 5.0s | scale: 1.01 | どっしりとした重厚感 |

#### 口癖配列

```typescript
JUDGE_PHRASES = {
  hiroyuki: [
    "なんか、そういうデータあるんですか？",
    "嘘つくのやめてもらっていいですか？",
    "なんだろう……",
    "無理じゃないですか？",
    "頭の悪い人には分からないかもしれないですけど",
    "それってあなたの感想ですよね",
    "僕はさっきから、事実の話をしてるんですよ",
    "はい、論破",
  ],
  dewi: [
    "わたくし、嘘は大嫌いですの",
    "何ですって！？",
    "あら、素敵じゃない",
    "本物を見極める力が必要なんですのよ",
    "そんなこと、わたくしには通用いたしませんざます",
    "わたくしの社交界では……",
    "お里が知れますわよ",
    "オ〜ッホッホッホ！",
    "フンッ",
    "まあ……",
  ],
  nakao: [
    "なんだよ...",
    "ふむ...",
    "悪くないね",
    "ほう...",
    "粋だねぇ",
    "野暮だよ",
    "本物だね",
    "なんだい？",
    "いいじゃない",
    "なかなか良いじゃねぇか",
    "理屈じゃないんだよ",
    "お前さぁ……",
    "やめなよ",
    "ふんっ",
  ],
}
```

---

## 🔧 技術仕様

### データモデル (DynamoDB)

N/A（フロントエンドのみの変更）

### API設計

N/A（既存APIを変更なし）

### コンポーネント設計

#### 新規作成ファイル

| ファイルパス | 説明 |
|-------------|------|
| `features/judging/components/JudgeAvatars.tsx` | 背景コンテナ（横並び、常時表示） |
| `features/judging/components/JudgeSpeechBubble.tsx` | 吹き出しUI（複数行対応: whitespace-normal） |
| `features/top/components/PostFormModal.tsx` | 投稿フォームモーダル（bg-black/60） |
| `shared/hooks/useJudgeEntrance.ts` | 登場アニメーション制御（1.2s完了判定） |
| `shared/hooks/useJudgeBreathing.ts` | 待機アニメーション制御 |
| `shared/hooks/useJudgeSpeech.ts` | 口癖選択・タイミング制御（連続同一セリフ回避） |

#### 修正ファイル

| ファイルパス | 変更内容 |
|-------------|---------|
| `features/judging/components/JudgeAvatar.tsx` | framer-motion統合 |
| `shared/constants/animations.ts` | JUDGE_ENTRANCE, JUDGE_BREATHING追加 |
| `shared/constants/avatar.ts` | JUDGE_PHRASES, SPEECH_*追加 |
| `App.tsx` | レイヤー構造へのリファクタリング、isPostModalOpen状態追加 |

#### コンポーネント階層

```
App.tsx
├── JudgeAvatars (背景レイヤー、z-0)
│   ├── JudgeAvatar x3 (framer-motion)
│   │   └── motion.img
│   └── JudgeSpeechBubble (AnimatePresence)
├── MainContent (手前レイヤー、z-10)
│   ├── Header + SoundButton
│   ├── RankingSection (viewMode === "top")
│   ├── "投稿する"ボタン (viewMode === "top")
│   ├── 審査中インジケーター (viewMode === "judging")
│   └── Footer
├── PostFormModal (z-50)
├── ResultModal (既存)
└── その他モーダル
```

### アニメーション定数設計

```typescript
// shared/constants/animations.ts

export const JUDGE_ENTRANCE = {
  hiroyuki: {
    initial: { y: 100, x: -30, opacity: 0, scale: 0.8 },
    animate: { y: 0, x: 0, opacity: 1, scale: 1 },
    transition: { type: "spring", bounce: 0.4, duration: 0.8 },
  },
  dewi: {
    initial: { x: 200, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    transition: { duration: 1.0, ease: "easeOut" },
  },
  nakao: {
    initial: { x: -200, opacity: 0, scale: 0.9 },
    animate: { x: 0, opacity: 1, scale: 1 },
    transition: { duration: 1.2, ease: [0.25, 0.1, 0.25, 1] },
  },
} as const;

export const JUDGE_BREATHING = {
  hiroyuki: {
    keyframes: { scale: [1, 1.02, 1] },
    transition: { duration: 2.0, repeat: Infinity, ease: "easeInOut" },
  },
  dewi: {
    keyframes: { scale: [1, 1.05, 1], y: [0, -3, 0] },
    transition: { duration: 4.0, repeat: Infinity, ease: "easeInOut" },
  },
  nakao: {
    keyframes: { scale: [1, 1.01, 1] },
    transition: { duration: 5.0, repeat: Infinity, ease: "easeInOut" },
  },
} as const;

// shared/constants/avatar.ts

export const SPEECH_INTERVAL_MS = { MIN: 4000, MAX: 8000 } as const;
export const SPEECH_DURATION_MS = 2500;
export const ENTRANCE_DURATION_MS = 1200; // 中尾彬風のアニメーション時間
```

---

## 🧪 テスト計画 (TDD)

### framer-motion テストモック

```typescript
// テストファイル内で使用
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
    img: ({ src, alt, ...props }) => <img src={src} alt={alt} {...props} />,
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));
```

### ランダム要素テストモック

```typescript
// Math.randomをモック
const mockRandom = vi.spyOn(Math, "random");
mockRandom.mockReturnValueOnce(0.5).mockReturnValueOnce(0.3);
```

### Unit Test (Hooks)

#### useJudgeEntrance.test.ts
- [ ] 正常系: 初期状態でhasEntered=false
- [ ] 正常系: 1200ms経過でhasEntered=true（中尾彬風のアニメーション時間）
- [ ] 境界値: Reduced Motion時は即座にhasEntered=true
- [ ] 正常系: 各審査員のバリアントが正しく設定される

#### useJudgeBreathing.test.ts
- [ ] 正常系: hasEntered=true かつ isSpeaking=false でisBreathing=true
- [ ] 正常系: isSpeaking=true でisBreathing=false（口パク優先）
- [ ] 境界値: Reduced Motion時はisBreathing=false

#### useJudgeSpeech.test.ts
- [ ] 正常系: isJudging=falseでは発話しない
- [ ] 正常系: isPostModalOpen=trueでは発話しない
- [ ] 正常系: isJudging=true && !isPostModalOpen でランダム間隔後に発話開始
- [ ] 正常系: SPEECH_DURATION_MS後に発話終了
- [ ] 正常系: 同一審査員の連続選択は許容される
- [ ] 正常系: 同じセリフは連続して選ばれない
- [ ] 境界値: アンマウント時にタイマーがクリアされる

### Unit Test (Components)
#### JudgeAvatars.red.test.tsx
- [ ] 正常系: viewModeに関係なくレンダリングされる
- [ ] 正常系: isJudging=falseで口癖が表示されない
- [ ] 正常系: isJudging=trueで口癖が表示される
- [ ] 正常系: 横並びレイアウト（flex-row）が適用される
- [ ] 正常系: レスポンシブサイズ（w-20 md:w-32）が適用される

#### JudgeSpeechBubble.red.test.tsx
- [ ] 正常系: 吹き出しが表示される
- [ ] 正常系: aria-live="polite"が設定される
- [ ] 正常系: AnimatePresenceで出入りアニメーション
- [ ] 正常系: 複数行テキストが正しく折り返される（whitespace-normal）

#### PostFormModal.red.test.tsx
- [ ] 正常系: isOpen=trueでモーダルが表示される
- [ ] 正常系: isOpen=falseでモーダルが非表示
- [ ] 正常系: Escキーでモーダルが閉じる
- [ ] 正常系: 背景クリックでモーダルが閉じる
- [ ] 正常系: フォーム送信でonSubmitが呼ばれる
- [ ] 正常系: 背景がbg-black/60で表示される

### Integration Test

#### App.integration.test.tsx
- [ ] 正常系: 初期表示で審査員が背景に表示される
- [ ] 正常系: 投稿ボタンでモーダルが開く
- [ ] 正常系: モーダル中は口癖が表示されない
- [ ] 正常系: 投稿完了でモーダルが閉じ、審査中になる
- [ ] 正常系: 審査中に口癖が表示される
- [ ] 正常系: 審査完了で結果モーダルが表示される
- [ ] 正常系: 結果モーダル表示後、審査員は待機状態に戻る

---

## ✅ 受入条件 (AC) - Given-When-Then

### 正常系 (Happy Path)

- [x] **Given** ユーザーがトップページにアクセス
      **When** ページが読み込まれる
      **Then** 背景に3人の審査員が登場アニメーションで表示され、1.2秒後に呼吸アニメーションで待機する

- [x] **Given** ユーザーがトップページを閲覧中
      **When** 「投稿する」ボタンをクリック
      **Then** 投稿フォームがモーダルとして手前に表示され（bg-black/60）、背景の審査員が透けて見える

- [x] **Given** ユーザーが投稿フォームに入力済み
      **When** 投稿ボタンをクリック
      **Then** モーダルが閉じ、審査員が口癖発話を開始し、審査中インジケーターが表示される

- [x] **Given** 審査中
      **When** 審査が完了
      **Then** 結果モーダルが表示され、審査員は待機状態に戻る

### 異常系 (Error Path)

- [x] **Given** 審査中
      **When** 60秒経過しても審査が完了しない
      **Then** タイムアウトエラーメッセージが表示される

- [x] **Given** 投稿モーダルが開いている
      **When** Escキーを押す
      **Then** モーダルが閉じる

### 境界値 (Edge Case)

- [x] **Given** ユーザーがprefers-reduced-motionを設定済み
      **When** ページが読み込まれる
      **Then** 登場・呼吸アニメーションがスキップされ、即座に審査員が表示される

- [x] **Given** スマホ幅（375px）で閲覧中
      **When** 審査員が表示される
      **Then** 3人が横一列に収まり、吹き出しが見切れない

- [x] **Given** 審査中
      **When** 画像読み込みに失敗
      **Then** グレーアウトしたプレースホルダーが表示され、クラッシュしない

- [x] **Given** 審査中
      **When** 同一審査員が連続して選ばれる
      **Then** 前回と異なるセリフが表示される

---

## 🔗 関連資料

- 既存アバター実装: `.github/E23_animetion.md`
- 画面設計書: `docs/screen_design.md`
- アニメーション定数: `frontend/src/shared/constants/animations.ts`
- 既存フック: `frontend/src/shared/hooks/useJudgeAvatar.ts`

---

**レビュアーへの確認事項:**
- [x] UIフローが既存機能（ポーリング、サウンド、結果モーダル）と整合するか
- [x] framer-motionのアニメーションがパフォーマンスに影響しないか
- [x] テスト計画が正常系/異常系/境界値を網羅しているか
- [x] アクセシビリティ（Reduced Motion、aria-live）が適切か
- [x] 登場完了タイミングが明確か（1.2s）
- [x] モーダル中の口癖停止が定義されているか
- [x] 連続同一セリフ回避が定義されているか
