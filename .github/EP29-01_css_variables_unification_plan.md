# EP29-01: 審査員UIスタイルのCSS変数統一プラン

## Context

JudgeSlot.tsxにブレークポイント直書きのスタイル値が散在しており、保守性が低下している。また、App.tsxでvh/px/remが混在しており、縦方向の基準が統一されていない。これらをCSS変数で一元管理し、レスポンシブ対応を整理する。

**重要な発見**: 現在`--judge-slot-scale`は`.judge-desk-panel`クラス内でのみ定義されており、スコープが限定されている。吹き出しやアバターで使用するには`:root`に移動する必要がある。

## 対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `frontend/src/index.css` | CSS変数の`:root`移動と追加定義 |
| `frontend/src/features/judging/components/JudgeSlot.tsx` | 直書き値をCSS変数化 |
| `frontend/src/App.tsx` | bottom値のvh廃止 |
| `frontend/src/features/judging/components/__tests__/JudgeAvatars.refactor.test.tsx` | テスト検証方法の更新 |
| `frontend/src/__tests__/App.gameShowLayout.refactor.test.tsx` | テスト検証方法の更新 |

---

## 実装ステップ

### Step 1: index.cssのCSS変数を`:root`に移動・追加

**現状**:
```css
/* 行480: .judge-desk-panel内に定義 */
.judge-desk-panel {
  --judge-slot-scale: 0.8;
  /* ... */
}

/* 行863-947: 各ブレークポイントで.judge-desk-panel内の変数を上書き */
@media (max-width: 360px) {
  .judge-desk-panel {
    --judge-slot-scale: 0.64;
  }
}
/* ... */
```

**変更後**:
```css
/* :rootに移動（グローバルスコープ化） */
:root {
  /* 既存 */
  --font-digital: 'DSEG7-Classic', 'Orbitron', 'Courier New', monospace;
  --main-action-track-width: min(82vw, 18.25rem);
  --main-action-gap: 0.42rem;

  /* 審査員UI基準スケール（移動） */
  --judge-slot-scale: 0.8;

  /* 新規: 審査員UI要素サイズ */
  --judge-avatar-width: calc(8.75rem * var(--judge-slot-scale));
  --judge-bubble-width: calc(12.5rem * var(--judge-slot-scale));
  --judge-bubble-offset-y: calc(8.75rem * var(--judge-slot-scale));
  --judge-score-width: calc(20rem * var(--judge-slot-scale));
  --judge-stack-offset-y: calc(5rem * var(--judge-slot-scale));
  --judge-score-margin-top: calc(3.125rem * var(--judge-slot-scale));
  --judge-avatar-margin-bottom: calc(2.5rem * var(--judge-slot-scale));
}

/* ブレークポイントでの上書き */
@media (max-width: 360px) {
  :root {
    --judge-slot-scale: 0.64;
  }
}

@media (min-width: 640px) {
  :root {
    --judge-slot-scale: 0.86;
  }
  /* ... 既存の他のスタイルは維持 ... */
}

@media (min-width: 768px) {
  :root {
    --judge-slot-scale: 0.92;
  }
}

@media (min-width: 1024px) {
  :root {
    --judge-slot-scale: 1.4;
  }
}

@media (min-width: 1280px) {
  :root {
    --judge-slot-scale: 1.55;
  }
}

@media (min-width: 1536px) {
  :root {
    --judge-slot-scale: 1.68;
  }
}

/* .judge-desk-panel内の定義は削除（:rootから継承） */
.judge-desk-panel {
  /* --judge-slot-scale: 0.8; ← 削除 */
  border-radius: 1rem;
  /* ... */
}
```

**各ブレークポイントでのスケール値**（既存と同じ）:
| ブレークポイント | --judge-slot-scale |
|------------------|-------------------|
| max-360px | 0.64 |
| base | 0.8 |
| sm (640px+) | 0.86 |
| md (768px+) | 0.92 |
| lg (1024px+) | 1.4 |
| xl (1280px+) | 1.55 |
| 2xl (1536px+) | 1.68 |

### Step 2: JudgeSlot.tsxのクラス置換

**置換マッピング**:

| 現状 (行番号) | 置換後 |
|--------------|--------|
| 行22: `AVATAR_SIZE_CLASS = 'h-auto w-28 sm:w-36 md:w-48 lg:w-56 xl:w-64 2xl:w-72'` | 定数削除、style使用 |
| 行209: 吹き出し `className="-top-28 sm:-top-[7.5rem] md:-top-[8.5rem] lg:-top-[9.5rem] xl:-top-[10.5rem] 2xl:-top-[11rem]"` | `style={{ top: 'calc(-1 * var(--judge-bubble-offset-y))' }}` |
| 行209: 吹き出し `w-40 sm:w-52 md:w-60 lg:w-64 xl:w-72 2xl:w-80` | `style={{ width: 'var(--judge-bubble-width)' }}` |
| 行223: アバター `className={AVATAR_SIZE_CLASS}` | `style={{ width: 'var(--judge-avatar-width)', height: 'auto' }}` |
| 行223: アバター `-mb-8 md:-mb-14 lg:-mb-16` | `style={{ marginBottom: 'calc(-1 * var(--judge-avatar-margin-bottom))' }}` |
| 行223: アバター `-translate-y-16 md:-translate-y-[5.5rem] lg:-translate-y-[7rem]` | `style={{ transform: 'translateY(calc(-1 * var(--judge-stack-offset-y)))' }}` |
| 行241: スコア `-mt-10 md:-mt-14 lg:-mt-[4.5rem] xl:-mt-[5rem]` | `style={{ marginTop: 'calc(-1 * var(--judge-score-margin-top))' }}` |
| 行241: スコア `max-w-[16rem] sm:max-w-[18rem] md:max-w-[22rem] lg:max-w-[26rem] xl:max-w-[30rem] 2xl:max-w-[34rem]` | `style={{ maxWidth: 'var(--judge-score-width)' }}` |

**変更後のJudgeSlot.tsx構造**:

```tsx
// 行22: AVATAR_SIZE_CLASS定数を削除

// 行209: 吹き出し
{speechText && showSpeech && (
  <div
    className="absolute left-1/2 z-30 -translate-x-1/2"
    style={{
      top: 'calc(-1 * var(--judge-bubble-offset-y))',
      width: 'var(--judge-bubble-width)',
    }}
  >
    <JudgeSpeechBubble ... />
  </div>
)}

// 行223: アバター
<div
  className="relative z-10"
  style={{
    marginBottom: 'calc(-1 * var(--judge-avatar-margin-bottom))',
    transform: 'translateY(calc(-1 * var(--judge-stack-offset-y)))',
  }}
>
  <div className={isSpeaking ? AVATAR_BREATHING_CLASS : ''}>
    <motion.img
      src={getAvatarImagePath(judge, avatarState)}
      alt={alt}
      style={{ width: 'var(--judge-avatar-width)', height: 'auto' }}
      initial={entranceVariant.initial}
      animate={entranceVariant.animate}
      transition={entranceVariant.transition}
      draggable={false}
    />
  </div>
</div>

// 行241: スコアパネル
<div
  data-testid="judge-desk-score"
  data-lit={isLit ? 'true' : 'false'}
  className={`judge-desk-panel judge-seat-panel vip-judge-desk ${deskStateClass} ${bulbStateClass} ${scoreMotionClass} ${particleClass} glass-panel relative z-20 w-full`}
  style={{
    maxWidth: 'var(--judge-score-width)',
    marginTop: 'calc(-1 * var(--judge-score-margin-top))',
  }}
  aria-label={scoreAriaLabel}
  role="group"
>
```

### Step 3: App.tsxのbottom値統一

**現状 (行1285-1286)**:
```tsx
viewMode === 'judging'
  ? 'bottom-24 px-2 sm:bottom-[5.5rem] sm:px-3 md:bottom-[4.5rem] md:px-4 lg:bottom-10 lg:px-6'
  : 'bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] px-2 sm:bottom-5 sm:px-3 md:bottom-6 md:px-4 lg:bottom-[7vh] lg:px-6'
```

**変更後**:
```tsx
viewMode === 'judging'
  ? 'bottom-24 px-2 sm:bottom-24 sm:px-3 md:bottom-24 md:px-4 lg:bottom-10 lg:px-6'
  : 'bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] px-2 sm:bottom-5 sm:px-3 md:bottom-6 md:px-4 lg:bottom-10 lg:px-6'
```

**変更点**:
- `lg:bottom-[7vh]` → `lg:bottom-10` (vh廃止)
- 審査中: `sm:bottom-[5.5rem]` → `sm:bottom-24` (rem統一)
- 審査中: `md:bottom-[4.5rem]` → `md:bottom-24` (rem統一)

### Step 4: CTAエリアの垂直オフセット調整

**現状 (行1301)**:
```tsx
<div className="pointer-events-auto -mt-3 sm:-mt-4 md:-mt-5 lg:-mt-6">
```

**変更後**:
```tsx
<div className="pointer-events-auto -mt-2 sm:-mt-3 md:-mt-4 lg:-mt-5">
```

（スコアボードと投稿ボタンの間隔を1段階狭める）

### Step 5: テスト更新

#### JudgeAvatars.refactor.test.tsx

**行176-179**:
```tsx
// Before
expect(avatar).toHaveClass('w-28')
expect(avatar.className).toMatch(/md:w-48/)
expect(avatar.className).toMatch(/lg:w-56/)

// After
expect(avatar).toHaveStyle({ width: 'var(--judge-avatar-width)' })
```

**行192-199, 211, 223**:
```tsx
// Before
expect(avatar).toHaveClass('w-28')

// After
expect(avatar).toHaveStyle({ width: 'var(--judge-avatar-width)' })
```

#### App.gameShowLayout.refactor.test.tsx

**行58**:
```tsx
// Before
expect(avatar).toHaveClass('w-28')

// After
expect(avatar).toHaveStyle({ width: 'var(--judge-avatar-width)' })
```

---

## 検証方法

1. **テスト実行**:
   ```bash
   cd frontend && npm test
   ```

2. **視覚確認**: 以下の画面サイズでレイアウト確認
   - 390x844 (モバイル)
   - 768x1024 (タブレット)
   - 1366x768 (小さめデスクトップ)
   - 1920x1080 (標準デスクトップ)

3. **確認項目**:
   - 審査員の中央軸一致
   - 吹き出しとアバターの重なりなし
   - スコアパネルとアバターの適切なオーバーラップ
   - 投稿ボタンの位置
   - 電飾と席の一体感

---

## 回帰リスクと軽減策

| リスク | 影響度 | 軽減策 |
|--------|--------|--------|
| CSS変数計算の視覚的差異 | 中 | 全ブレークポイントで視覚確認必須 |
| テスト失敗 | 高 | 先にテストを修正してから実装 |
| Framer Motionのtransform競合 | 低 | 外側divに適用するパターンを維持 |
| :root移動による既存スタイルへの影響 | 低 | `.judge-desk-panel`内での再定義を削除し、継承に変更 |

---

## 実装順序（TDD準拠）

1. **RED**: テストファイルの検証方法を更新（まだ実装していないため失敗する）
2. **GREEN**: index.cssとJudgeSlot.tsx, App.tsxを実装
3. **REFACTOR**: 必要に応じてCSS変数の値を微調整
