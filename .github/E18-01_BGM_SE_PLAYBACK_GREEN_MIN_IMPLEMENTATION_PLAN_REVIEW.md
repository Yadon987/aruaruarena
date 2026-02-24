```text
- [重要度: 高]
  問題点: AC-07（audioUnlocked=false時は再生要求無視）が受入条件トレースから抜けており、実装範囲と判定条件が曖昧。
  改善提案: 今回の最小実装にAC-07を含め、`unlockAudio` 前は `playSceneBgm/playSe` がイベント記録も行わないことを明記する。

- [重要度: 高]
  問題点: E2E失敗要因として環境依存（libnspr4.so不足）と仕様未実装が混在しており、Green判定が曖昧。
  改善提案: Green判定を「Unit/Integration必須、E2Eは環境前提を満たす場合に必須」へ明確化し、環境不足時の代替確認（コード上のイベント発火条件レビュー）を定義する。

- [重要度: 中]
  問題点: `se_result_open` の発火タイミングが「結果モーダル表示時」とだけ書かれ、再レンダリング時の重複発火抑止条件が不足。
  改善提案: `isResultModalOpen` が `false -> true` に変化した瞬間のみ発火する最小条件を追加する。

- [重要度: 中]
  問題点: `playSceneBgm` の「同一シーンで再発火しない」最小条件が3章実装内容に未記載で、RED要件（同一シーン再レンダリング）を取りこぼす恐れがある。
  改善提案: 前回シーンを `ref` で保持し、同一シーンなら no-op する条件を明記する。

- [重要度: 低]
  問題点: 検証手順で対象テストケースとの対応が弱く、どの受入条件を満たしたか追跡しづらい。
  改善提案: ACとテストの対応表を簡潔に追加する。
```

## 修正版（完全版）

````markdown
# GREEN最小実装計画書（改訂版）: E18-01〜E18-06 BGM・SE再生

## 0. 目的

`.github/E18-01_BGM_SE_PLAYBACK_RED_TEST_PLAN.md` と Issue `#77` の受入条件を満たすため、現在FailしているREDテストをパスさせる最小限の実装を定義する。

- 対象: `useSound` 未実装によるUnit失敗、音声トグル未実装によるIntegration失敗
- 方針: テストを通すための最小変更のみ実施し、最適化・設計整理はRefactorへ後送り

---

## 1. 重要制約（今回の実装方針）

- テストをパスする最小限のコードのみ変更する
- 過剰な最適化（抽象化、責務分割、命名整理）は実施しない
- エッジケースの追加実装は行わない（後続フェーズで対応）
- マジックナンバーは現段階で許容する
- 既存機能（投稿、ランキング、既存モーダル）の挙動変更は行わない

---

## 2. 対象テストと失敗要因

### 2.1 対象REDテスト
- `frontend/src/features/top/__tests__/useSound.red.test.ts`
- `frontend/src/features/top/__tests__/soundToggle.integration.red.test.tsx`
- `frontend/e2e/sound-playback.red.spec.ts`（Playwright依存ライブラリが揃う環境で実行）

### 2.2 現在の主な失敗要因
- `frontend/src/hooks/useSound.ts` が存在せずimport解決に失敗している
- `App.tsx` に `音声OFF` トグルボタンと `aria-pressed` が存在しない
- `aruaru_sound_muted` 永続化処理が未実装
- 再生イベント記録（`window.__AUDIO_DEBUG__`）が未実装

---

## 3. 実装スコープ（Green最小）

### 3.1 変更対象ファイル
- `frontend/src/hooks/useSound.ts`（新規）
- `frontend/src/components/SoundToggleButton.tsx`（新規）
- `frontend/src/App.tsx`（最小変更）

### 3.2 実装内容
1. `useSound` の最小実装
- `isMuted` 初期値を `localStorage`（`aruaru_sound_muted`）から復元
- 未設定/不正値は `'true'` に正規化して保存
- `setMuted` で `isMuted` と `localStorage` を更新
- `unlockAudio` で `audioUnlocked = true` をセット
- `playSceneBgm` は `audioUnlocked && !isMuted` の時だけ動作
- シーン変更時のみ `__HOWLER_FADE_SPY__` へ `fade(1,0,500)` 相当の呼び出しを行う
- 同一シーン再レンダリング時は no-op とする（前回シーンを保持）
- `playSe` は `audioUnlocked && !isMuted` の時だけ動作し、例外を外へ投げない

2. 音声トグルUIの最小実装
- フッターへ `SoundToggleButton` を追加
- 初期表示ラベルは `音声OFF`
- クリックで `音声ON`/`音声OFF` を切り替え
- `aria-pressed` を `false/true` で更新

3. 最小のデバッグイベント記録
- `window.__AUDIO_DEBUG__` を配列として扱い、再生要求時に最小イベントをpush
  - BGM: `{ type: 'bgm', scene: 'top' | 'judging' }`
  - SE: `{ type: 'se', id: 'se_result_open' など }`
- `audioUnlocked=false` または `isMuted=true` の場合はイベントを記録しない

4. Appへの接続
- App初回描画時に `useSound` を初期化
- トグル押下時に `unlockAudio` + `setMuted(false/true)` を実行
- 画面モード遷移（top/judging）に応じて `playSceneBgm` を呼び出す
- `isResultModalOpen` が `false -> true` へ変化した時のみ `playSe('se_result_open')` を1回呼び出す

---

## 4. 受入条件トレース（今回対象分）

- AC-01 未設定時ミュート開始 + `localStorage='true'`: 3.2-1
- AC-02 ON後シーン遷移で500msクロスフェード: 3.2-1, 3.2-4
- AC-03 結果モーダル表示で `se_result_open` 1回: 3.2-3, 3.2-4
- AC-04 音声読み込み失敗時も継続動作: 3.2-1
- AC-05 不正値を `true` に正規化: 3.2-1
- AC-07 `audioUnlocked=false` なら再生要求無視: 3.2-1, 3.2-3

注記:
- エッジケース（連打時の最終状態一致、多重再生の高度最適化）は今回スコープ外

---

## 5. 実装手順

1. `useSound.ts` を新規作成し、REDテストが要求する公開APIを実装
2. `SoundToggleButton.tsx` を新規作成し、ラベル/`aria-pressed` を実装
3. `App.tsx` に音声トグルを追加し、`useSound` を接続
4. `viewMode` 変更で `playSceneBgm`、結果モーダルのオープン遷移で `playSe('se_result_open')` を呼ぶ

---

## 6. 検証手順（Green最小）

`frontend` で実行:

1. `npm run test -- src/features/top/__tests__/useSound.red.test.ts src/features/top/__tests__/soundToggle.integration.red.test.tsx`
2. `npm run test:e2e -- sound-playback.red.spec.ts`（Playwright依存ライブラリがある環境で実行）

AC対応:
- AC-01/05: `useSound.red.test.ts` の初期化・正規化テスト
- AC-02: `useSound.red.test.ts` のクロスフェードテスト + `sound-playback.red.spec.ts` の遷移テスト
- AC-03: `sound-playback.red.spec.ts` の `se_result_open` テスト
- AC-04: `useSound.red.test.ts` の例外非送出テスト
- AC-07: `soundToggle.integration.red.test.tsx` の初回操作前イベント0件テスト

判定:
- Unit/Integrationの対象REDテストがすべてパス
- E2Eは環境前提を満たす場合にパス

---

## 7. 完了条件

- 対象REDテスト（Unit/Integration）がGreen化される
- Issue #77の受入条件のうち今回対象（AC-01〜AC-05, AC-07）を満たす
- 追加実装が最小範囲（`useSound.ts`, `SoundToggleButton.tsx`, `App.tsx`）に留まる

---

## 8. コミット方針

コミットメッセージ案（Issue番号必須）:

`feat: E18-01 BGM・SE再生のGreen最小実装 #77`

コミット本文案:
- `useSound` の最小実装（ミュート永続化・正規化・再生API）を追加
- フッターへ音声トグル（`音声OFF/ON`, `aria-pressed`）を追加
- AppにBGM/SE呼び出しの最小接続を追加
````
