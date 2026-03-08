# 審査員UI ゴージャス化（VIPゴージャスプラン）完全版

## 目的
- 審査員UIを「サイバー・ネオン」から「VIPゴージャス（金・赤）」へ段階移行する。
- 既存画面の破壊を避けるため、既存クラスは削除せず `vip-*` クラスを追加して限定適用する。

## 非機能・安全方針
- 影響範囲は `JudgeSlot` 配下に限定する。
- `prefers-reduced-motion: reduce` では点滅やルーレットを停止する。
- 電球DOMは固定14個とし、性能劣化を防ぐ。

## 実装ステップ
1. `JudgeSlot.tsx`
- `phase` から演出状態を導出（idle/scoring/complete）。
- `vip-judge-desk` / `vip-judge-seat` / `vip-score-text` を適用。
- 電球DOM（14個）を `vip-bulb-track` 配下に追加。
- 状態に応じて `vip-bulbs-idle` / `vip-bulbs-roulette` / `vip-bulbs-flash` を切替。

2. `index.css`
- `vip-*` クラスを追加（既存クラスは残す）。
- 金フレーム、黒ベース、赤ベルベット背もたれ、スコア赤表示を定義。
- 電球アニメーション（ルーレット / フラッシュ）を定義。
- `prefers-reduced-motion` の抑制ルールを追加。

3. `tailwind.config.js`
- `vip-gold` / `vip-red` 系の色トークンを追加。
- `vip-roulette` / `vip-flash` キーフレームと `animation` を追加。

4. `JudgeAvatars.tsx`
- ゴージャス枠の太さに合わせてコンテナ余白・間隔を微調整。

## 検証
- 手動: 審査中（ルーレット）→審査完了（点滅→点灯）を確認。
- レスポンシブ: 320/768/1024+ で崩れ確認。
- 自動: `JudgeAvatars` 系テストを実行。
