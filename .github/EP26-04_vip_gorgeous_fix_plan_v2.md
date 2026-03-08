# EP26-04 VIPゴージャス化 修正プラン v2

## 背景
- 旧ネオン（シアン/ピンク）が一部残り、VIP配色と混在している。
- デスク本体の不透明感が弱く、電球が浮いて見える。
- 背もたれが平坦で、ベルベット質感が弱い。
- 電球が平面で、球体感が不足している。

## 方針
- 既存ネオンクラスは削除しないが、VIPデスクでは参照しない。
- `vip-judge-desk` 側で色と質感を完全上書きし、旧ネオン影響を遮断する。
- 背もたれは radial + 深紅グラデーションで立体感を強化する。
- 電球は内核と内側シャドウを追加して球体化する。

## 実装手順
1. `JudgeSlot.tsx`
- `JUDGE_NEON_CLASS` 依存を除去。
- パネルから `glass-panel` と `neon-border-*` を外す。
- スコア文字から `neon-text-*` を外し、`vip-score-text` のみ適用。

2. `index.css`
- `vip-judge-desk` を不透明・重厚（黒+金）へ強化。
- `vip-judge-seat` を中央明るめ/外周暗めのベルベット勾配へ調整。
- `vip-bulb` に内核（`::after`）と内側影を追加。
- 旧 `data-lit` のネオン色ルールを `:not(.vip-judge-desk)` に限定し、VIPへ影響させない。

3. 検証
- `JudgeAvatars.red` / `JudgeAvatars.refactor` / `JudgeAvatarsIntegration` を実行。
