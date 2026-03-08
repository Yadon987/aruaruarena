# UIレイアウト改修プラン - レビュー結果と完全版

## 元計画書のレビュー結果

### 概要
元計画書（`implementation_plan.md.resolved`）は3つの改善項目を提示しているが、実装詳細が曖昧で、現状のコード構造との乖離がある。

---

## 指摘事項

### 1. 背景画像の設定

**元計画の問題点:**
- `game-show-stage`クラスへの背景設定とあるが、**現在このクラスはCSSで定義されていない**（Tailwindユーティリティのみ）
- 背景画像ファイルのパスが明記されていない
- オーバーレイの実装方法が不明確

**改善案:**
- `frontend/src/index.css`に`.game-show-stage`クラスを新規定義
- 背景画像パス: `frontend/public/images/stage-bg.png`（要確認）
- `background-size: cover; background-position: center bottom;`を適用
- オーバーレイは`::before`疑似要素で実装（rgba(0,0,0,0.3)程度）

### 2. 審査員と審査パネルの一体化

**元計画の問題点:**
- 「Gridレイアウトをベースとし、1カラムの中に吹き出し・アバター・パネルを縦積み」とあるが、**現在の構造は既にそれに近い**
- 現状: `JudgeAvatars`内でアバターをflex-rowで横並び、`JudgeDesk`をabsoluteで下部に配置
- 真の問題は**absolute配置による位置ズレ**であり、構造の組み替えではなく**1カラム単位でのカプセル化**が必要

**改善案:**
```
現状:
ul (flex-row)
  └── li (flex-col) [吹き出し + アバター]
  └── li (flex-col) [吹き出し + アバター]
  └── li (flex-col) [吹き出し + アバター]
div (absolute bottom-0) [JudgeDesk Grid]

推奨:
div (grid 3col)
  └── div (flex-col) [吹き出し + アバター + パネル]
  └── div (flex-col) [吹き出し + アバター + パネル]
  └── div (flex-col) [吹き出し + アバター + パネル]
```

- 新コンポーネント`JudgeSlot`を作成し、1審査員分（吹き出し+アバター+パネル）をカプセル化
- 親コンポーネント`JudgeStage`で3カラムGrid管理
- これによりアバターとパネルの位置関係が強固になる

### 3. 全体の表示位置の調整

**元計画の問題点:**
- 「Fixed配置から解放するか、Fixedのままでも」と曖昧
- **現状はFixed配置ではない**（relative配置）
- 真の問題は**フッターとの余白計算**と**コンテンツの垂直位置**

**改善案:**
- 現状の`relative`配置を維持
- `paddingBottom: ${footerReservedSpace}px`の計算ロジックを確認・調整
- 審査員ブロックを画面中央〜やや下寄りに配置するため、flexboxの`justify-center`または`margin: auto`を活用

---

## 完全版プラン

### Phase 1: 背景画像の実装

**変更ファイル:**
- `frontend/src/index.css` - `.game-show-stage`クラス追加
- `frontend/public/images/stage-bg.png` - 背景画像配置（要確認）

**実装内容:**
```css
.game-show-stage {
  background-image: url('/images/stage-bg.png');
  background-size: cover;
  background-position: center bottom;
  background-repeat: no-repeat;
  position: relative;
}

.game-show-stage::before {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  pointer-events: none;
  z-index: 0;
}
```

### Phase 2: 審査員スロットコンポーネントの作成

**新規ファイル:**
- `frontend/src/features/judging/components/JudgeSlot.tsx`

**変更ファイル:**
- `frontend/src/features/judging/components/JudgeAvatars.tsx` - リファクタリング
- `frontend/src/features/judging/components/JudgeDesk.tsx` - パネル部分のみ抽出

**実装内容:**
```tsx
// JudgeSlot.tsx
interface JudgeSlotProps {
  judge: JudgePersona
  speechText: string | null
  avatarState: AvatarState
  entranceVariant: EntranceVariant
  judgment?: JudgeDeskJudgment
  phase: JudgeDeskPhase
  showSpeech: boolean
}

export function JudgeSlot({ ... }: JudgeSlotProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      {/* 吹き出し */}
      {speechText && showSpeech && <JudgeSpeechBubble ... />}

      {/* アバター */}
      <motion.img ... />

      {/* スコアパネル */}
      <div className="judge-desk-panel glass-panel ...">
        <span className="digital-score ...">{scoreLabel}</span>
      </div>
    </div>
  )
}
```

### Phase 3: 親コンポーネントのGrid化

**変更ファイル:**
- `frontend/src/features/judging/components/JudgeAvatars.tsx`

**実装内容:**
```tsx
// JudgeAvatars.tsx（リファクタリング後）
export function JudgeAvatars({ ... }: JudgeAvatarsProps) {
  return (
    <div
      data-testid="judge-stage"
      className="relative mx-auto w-full max-w-6xl"
    >
      <div className="grid grid-cols-3 gap-4 md:gap-6 lg:gap-8">
        {JUDGE_CONFIG.map((judge) => (
          <JudgeSlot
            key={judge.id}
            judge={judge.id}
            speechText={...}
            avatarState={...}
            entranceVariant={...}
            judgment={...}
            phase={judgingPhase}
            showSpeech={judgingPhase !== 'scoring'}
          />
        ))}
      </div>
    </div>
  )
}
```

### Phase 4: 位置調整とフッター余白

**変更ファイル:**
- `frontend/src/App.tsx` - レイアウト調整

**実装内容:**
- `footerReservedSpace`の計算ロジックを確認
- 審査員ブロックを中央寄せ: `flex flex-col justify-center`を親に追加
- 必要に応じて`min-h-[calc(100vh-footerReservedSpace)]`を調整

---

## 検証計画

### 自動テスト
```bash
# フロントエンドのテスト実行
cd frontend && npm test

# E2Eテスト（存在する場合）
npm run test:e2e
```

### 手動検証
1. `npm run dev`で開発サーバー起動
2. PC（横長）・スマホ（縦長）で表示確認
   - 背景画像が適切に表示・トリミングされているか
   - 審査員アバターとパネルの縦位置が一致しているか
   - レスポンシブに伸縮するか
   - テキスト・ボタンの視認性

---

## リスクと対策

| リスク | 対策 |
|-------|------|
| 背景画像が存在しない | 代替画像の使用またはグラデーション背景で実装 |
| 既存テストが壊れる | DOM構造変更に伴うセレクタ更新 |
| アニメーションが壊れる | `framer-motion`のバリアントを継承 |

---

## タスク分割

1. **[T1]** 背景画像の確認と配置
2. **[T2]** `index.css`に`.game-show-stage`スタイル追加
3. **[T3]** `JudgeSlot`コンポーネント作成
4. **[T4]** `JudgeAvatars`のGrid化リファクタリング
5. **[T5]** `JudgeDesk`のパネル抽出
6. **[T6]** テスト更新と動作確認

---

## 進捗ステータス（2026-03-08 更新）

- **[T1] 完了**: `frontend/public/images/stage-bg.png` を配置
- **[T2] 完了**: `frontend/src/index.css` に `.game-show-stage` 背景スタイルを追加
- **[T3] 完了**: `frontend/src/features/judging/components/JudgeSlot.tsx` を作成
- **[T4] 完了**: `JudgeAvatars` を3カラムGrid構成へリファクタリング
- **[T5] 完了**: スコアパネル表示を `JudgeSlot` 側へ移管
- **[T6] 完了**: 関連テストを更新し、審査員UIの単体・統合テストを実行

---

*作成日: 2026-03-08*
*元計画書: implementation_plan.md.resolved*
