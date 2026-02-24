```text
- [重要度: 高]
  問題点: RED失敗の判定基準が「1件以上Fail」のみで、想定外失敗（環境不備）と仕様未実装による失敗を区別できない。
  改善提案: 失敗メッセージに仕様キーワード（例: `audioUnlocked`, `se_result_open`）が含まれることを確認項目に追加し、RED失敗の妥当性を担保する。

- [重要度: 高]
  問題点: AC-06のIntegration対応が「追加予定」のままで未確定。
  改善提案: 「トグル連打後に `aria-pressed` が最終クリック状態と一致」を明示的なテストケースとして確定する。

- [重要度: 高]
  問題点: 「各テストにコメント」の要件が抽象的で、レビュー時に不一致が起きる。
  改善提案: コメント書式を `// 何を検証するか: ...` で固定し、`it/test` 直下1行目に必須と明記する。

- [重要度: 中]
  問題点: E2Eの音再生検証がイベント前提だが、計測用フックの導入条件が未定義。
  改善提案: `window.__AUDIO_DEBUG__` 配列へ再生要求イベントをpushする計測方針をREDテスト前提として定義する。

- [重要度: 中]
  問題点: 非機能要件（多重再生防止）に対する単体テストの観測点が不足。
  改善提案: Howlerモックの `play/fade/stop/unload` 呼び出し回数を明示的に検証するケースを追加する。

- [重要度: 中]
  問題点: 境界値として「初回ユーザー操作前の画面遷移・モーダル表示時に再生しない」がE2Eで明示されていない。
  改善提案: 初回操作前に画面遷移を発生させ、`__AUDIO_DEBUG__` が空配列のままであることを追加する。

- [重要度: 低]
  問題点: 実行コマンドが並列実行環境で不安定になる可能性がある。
  改善提案: Unit/Integrationは `--runInBand` を使用し、RED確認を安定化する。
```

## 修正版（完全版）

````markdown
# [PLAN] E18-01〜E18-06 BGM・SE再生 REDテスト実装計画

## 📋 概要
`.github/E18-01_BGM_SE_PLAYBACK_SPEC_PLAN.md` の受入条件を、実装前に失敗するREDテストへ分解して先行作成する計画。

## 🎯 目的
- 受入条件（AC）をテストケースへ1対1でマッピングする。
- すべてのREDテストを「現状では失敗する状態」で追加し、Green実装の完了条件を明確化する。
- `CLAUDE.md` の禁止事項（日本語コメント、日本語コミット、Issue番号付きコミット）を満たす。

---

## 🧭 対象範囲

### テスト対象ファイル（新規）
- `frontend/src/features/top/__tests__/useSound.red.test.ts`
- `frontend/src/features/top/__tests__/soundToggle.integration.red.test.tsx`
- `frontend/e2e/sound-playback.red.spec.ts`

### 参照する既存ファイル
- `frontend/src/App.tsx`
- `frontend/src/components/ResultModal.tsx`
- `frontend/e2e/fixtures/test-fixtures.ts`

---

## 🧪 REDテスト設計（受入条件カバレッジ）

### A. Unit Test（useSound）
- `E18 RED: 初期値はミュートtrue`
- `E18 RED: localStorageがfalseならミュート解除復元`
- `E18 RED: 不正値はtrueに正規化`
- `E18 RED: シーン変更で500msクロスフェード`
- `E18 RED: 同一シーン再レンダリングで再生回数が増えない`
- `E18 RED: ミュートONで再生中BGM停止`
- `E18 RED: 連続遷移でもBGMインスタンス1以下`
- `E18 RED: 音声ロード失敗でも例外で落ちない`
- `E18 RED: 初回ユーザー操作前は再生要求を破棄`

### B. Integration Test（SoundToggleButton + App）
- `E18 RED: 初期表示で音声OFFラベル`
- `E18 RED: トグル押下でaria-pressed切替`
- `E18 RED: トグルONでlocalStorage false保存`
- `E18 RED: 初回ユーザー操作前は再生要求無視`
- `E18 RED: トグル連打後に最終クリック状態と一致`

### C. E2E Test（Playwright）
- `E18 RED: 初期表示で音声OFF`
- `E18 RED: 音声ON切替でlocalStorage false`
- `E18 RED: 初回操作前の画面遷移では再生イベント0件`
- `E18 RED: トップ画面から審査中画面でBGM切替イベント1回`
- `E18 RED: 結果モーダル表示でse_result_openイベント1回`
- `E18 RED: ミュートONへ戻すと再生イベント追加なし`

### D. AC対応表（トレーサビリティ）
| AC ID | 受入条件要約 | Unit | Integration | E2E |
|------|-------------|------|-------------|-----|
| AC-01 | 未設定時ミュート開始 + true保存 | 初期値はミュートtrue | 初期表示で音声OFFラベル | 初期表示で音声OFF |
| AC-02 | ON後シーン遷移で500msクロスフェード + 単一BGM | シーン変更クロスフェード / BGM1以下 | - | 審査中画面でBGM切替イベント1回 |
| AC-03 | 結果モーダルでse_result_open 1回 | - | - | 結果モーダルでイベント1回 |
| AC-04 | 音声読み込み失敗でも継続動作 | 音声ロード失敗でも落ちない | - | - |
| AC-05 | 不正localStorage値をtrue正規化 | 不正値はtrueに正規化 | - | - |
| AC-06 | 連打時に最終状態一致 + 多重再生なし | ミュートONで停止 / BGM1以下 | トグル連打後に最終クリック状態一致 | ミュートONでイベント追加なし |
| AC-07 | audioUnlocked=falseなら再生要求無視 | 初回操作前は再生要求を破棄 | 初回操作前は再生要求無視 | 初回操作前の遷移でイベント0件 |

---

## ✅ RED状態の担保方法
- 実装未着手の `useSound` / `SoundToggleButton` 仕様を先に期待値化する。
- テスト名に `E18 RED` を含める。
- すべての `it` / `test` の直下1行目に `// 何を検証するか: ...` コメントを付ける。
- RED確認時は「Fail件数が1件以上」かつ「失敗メッセージに仕様キーワード（`audioUnlocked` / `se_result_open` / `aria-pressed`）が含まれる」ことを確認する。

---

## 🔧 実装手順（REDのみ）
1. `frontend/src/features/top/__tests__/useSound.red.test.ts` を作成する。  
2. Unitテスト9ケースを追加する（Howlerモックの `play/fade/stop/unload` 回数検証を含む）。  
3. `frontend/src/features/top/__tests__/soundToggle.integration.red.test.tsx` を作成する。  
4. Integrationテスト5ケースを追加する。  
5. `frontend/e2e/sound-playback.red.spec.ts` を作成する。  
6. E2Eテスト6ケースを追加する。  
7. 計測用として `window.__AUDIO_DEBUG__`（再生要求イベント配列）を参照する。  
8. `cd frontend && npm run test -- --runInBand useSound.red.test.ts soundToggle.integration.red.test.tsx` を実行する。  
9. `cd frontend && npm run test:e2e -- sound-playback.red.spec.ts` を実行する。  
10. 終了コード1（Fail）と失敗メッセージを記録する。  

---

## 🧾 コミット計画
- コミットメッセージ案: `test: E18-06 BGM・SE再生REDテストを追加 #77`
- 本文（3行目以降）は以下を箇条書きで記載する。
  - AC対応表（AC IDごとのUnit/Integration/E2E対応）
  - RED失敗を確認した実行コマンド
  - 仕様キーワードを含む失敗ログ要約
  - Green実装が次ステップであること

---

## 🔍 事前チェック（CLAUDE.md準拠）
- [ ] コメントが日本語になっている
- [ ] コミットメッセージが日本語かつIssue番号 `#77` を含む
- [ ] 全テストに `// 何を検証するか:` がある
- [ ] REDテストがFailすることを確認済み
- [ ] Fail理由が仕様未実装に紐づいている
- [ ] 機密情報をハードコードしない
- [ ] `binding.pry` を含めない

---

## 完了条件
- REDテストファイル3本が作成済み
- AC-01〜AC-07がテストへマッピング済み
- 全テストに `// 何を検証するか:` コメントがある
- `npm run test -- --runInBand useSound.red.test.ts soundToggle.integration.red.test.tsx` がFailする
- `npm run test:e2e -- sound-playback.red.spec.ts` がFailする
- 失敗ログに仕様キーワード（`audioUnlocked` / `se_result_open` / `aria-pressed`）が含まれる
````
