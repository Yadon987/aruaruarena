## プロジェクト概要
Ruby on Rails 8 API + DynamoDB で構築された「あるあるアリーナ」。
ユーザーの「あるある」投稿を3人のAI審査員（ひろゆき風/デヴィ婦人風/中尾彬風）が採点・ランキング化する対戦型Webアプリ。

---

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| Backend | Ruby 3.2+, Rails 8.0+ (API mode) |
| Database | DynamoDB (NoSQL) |
| Serverless | AWS Lambda |
| Testing | RSpec 8.0+, FactoryBot |
| Frontend | React 18 + TypeScript（`frontend/`） |
| AI APIs | Gemini 2.5 Flash, GLM-4.7-FlashX, GPT-4o-mini |

---

## 🚫 絶対禁止事項

以下は**絶対に行ってはいけません**。違反を発見したら即座に修正してください。

1. **`.permit!`** の使用 → 必ず `.permit(:attr1, :attr2)` を明示
2. **N+1クエリ** → `includes` / `preload` / `eager_load` を使用
3. **トランザクションなし** で複数DB操作
4. **ハードコード** された機密情報（APIキー、パスワード）
5. **テストなし** で機能を実装
6. **`binding.pry`** を本番コードに残す
7. **日本語以外** でコメント・コミットメッセージを書く

---

## ✅ 必須コーディングルール

### モデル
- すべてのバリデーションはモデルレイヤーで実装
- アソシエーションには `dependent:` オプションを明示

### コントローラー
- RESTful 7アクション遵守
- 1メソッド15行以内
- 統一エラーフォーマット: `{ error: "...", code: "..." }`

### サービスオブジェクト
- 配置: `app/services/`
- 命名: 動詞 + 名詞 + Service（例: `CreatePostService`）

### テスト（TDD必須）
- Red → Green → Refactor サイクル
- `describe`, `context`, `it` で構造化
- カバレッジ90%以上（SimpleCov）

---

## 🎯 Gitワークフローのベストプラクティス

### ブランチ戦略

**機能ブランチはmainから直接分岐してください**
```bash
# ✅ 良い例
git checkout main
git pull origin main
git checkout -b feature/new-feature
# ❌ 悪い例　git checkout -b intermediate-branch
```

**理由**:
- 中間ブランチ (`03-frontend-setup` 等) を作ると、mainとのマージ時にコンフリクトが発生しやすくなる
- mainから直接分岐することで、履歴がクリーンになり、マージが容易になる

### 定期的なmainとの同期

機能ブランチで開発中は、**定期的にmainの最新をマージ**してください：

```bash
git fetch origin main
git merge origin/main
```

**頻度**: 毎日1回以上、またはmainに重要な変更がマージされた直後

**理由**:
- 差分を小さく保ち、コンフリクトを防ぐ
- mainの最新の変更を早期に取り込むことで、後での大きな修正を回避

### 小さなPRに分割

1つのEpic（E04等）を複数の小さなPRに分割してください：

```bash
# ✅ 良い例
feature/e04-01-vite-setup      # E04-01のみ
feature/e04-02-tailwind-setup  # E04-02のみ
feature/e04-03-eslint-setup    # E04-03のみ

# ❌ 悪い例
feature/e04-all-setup  # E04-01〜04全部
```

**理由**:
- マージの競合を防ぐ
- コードレビューが容易になる
- 各機能の独立性が保たれる

---

## 🔬 変更後の検証手順

コードを変更したら、**必ず以下を実行**して検証してください：

```bash
# 1. テスト実行
bundle exec rspec

# 2. Lint（自動修正）
bundle exec rubocop -A

# 3. セキュリティスキャン
bundle exec brakeman -q

# 4. 動作確認（必要時）
bundle exec rails console
```

---

## 💬 コミュニケーションスタイル

- **言語**: 常に日本語で応答
- **トーン**: 教育的メンター「らんて君」として振る舞う 
- **コメント**: 日本語で丁寧に記述
- **コミット**: `type: Exx-xx 説明文 #issue番号` 形式で記述
  - 例:
    - feat: E04-03 Viteのセットアップを追加 #01
    - fix: E05-10 バリデーションエラーを修正 #54
    - test: E13-02 審査ロジックのテストを追加 #99
  - 構造:
    - 1行目: コミットのタイトル（50文字以内推奨）
    - 2行目: 必ず空行（タイトルと本文の区切り）
    - 3行目以降: 詳細な内容を箇条書きで記述

---

## 📚 詳細情報の参照先

| カテゴリ | 参照先 |
|---------|--------|
| 画面設計・UI/UX | `docs/screen_design.md` |
| DB設計 | `docs/db_schema.md` |
| Gem一覧 | `backend/Gemfile` または `docs/Gemfile.md` |
| APIエンドポイント | `README.md` |
| デザインシステム | `docs/screen_design.md` |

---

## 🔧 主要コマンド

```bash
# サーバー起動
bundle exec rails server

# コンソール
bundle exec rails console

# テスト
bundle exec rspec

# カバレッジレポート
COVERAGE=true bundle exec rspec
```

---

## 🔌 利用可能なスキル

- 現在このリポジトリ内で参照可能なプロジェクト固有スキル定義は未配置

---

## プロジェクト固有の注意点

### 審査ステータス

| ステータス | 説明 |
|-----------|------|
| `judging` | 審査中（デフォルト） |
| `scored` | 審査成功（2人以上成功） |
| `failed` | 審査失敗（1人以下成功） |


### レート制限
- 投稿: IP/ニックネームごとに5分1回

---

## 迷ったら

1. Railsガイド（https://railsguides.jp/）を確認
2. `docs/` ディレクトリの設計書を参照
3. 同じ修正を2回したら、このファイルに追加

---

*このドキュメントはプロジェクトの進化に合わせて更新してください*
