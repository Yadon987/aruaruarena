# 📁 プロジェクト構成とアーキテクチャ

## 概要

あるあるアリーナ（Backend）のディレクトリ構成と、各ディレクトリの責務について解説します。
本プロジェクトは **Rails 8 (API Mode)** を採用し、**TDD (Test-Driven Development)** と **DDD (Domain-Driven Design)** のエッセンスを取り入れた構成としています。

---

## 🏗️ 全体構成図

```
aruaruarena/
├── app/                      # アプリケーションコア
│   ├── controllers/          # HTTPリクエストハンドリング
│   ├── models/               # データモデルとバリデーション
│   ├── services/             #★ ビジネスロジック (Fat Controller回避)
│   ├── adapters/             #★ 外部API連携 (AI, etc.)
│   ├── prompts/              #★ AIプロンプトテンプレート
│   └── serializers/          # JSONレスポンス整形
│
├── config/                   # 設定ファイル
│   ├── initializers/         # 初期化設定 (Dynamoid, CORS)
│   └── routes.rb             # ルーティング定義
│
├── spec/                     #★ テスト (RSpec)
│   ├── factories/            # テストデータ定義 (FactoryBot)
│   ├── models/               # モデルテスト
│   ├── requests/             # APIエンドポイントテスト (Integration)
│   ├── services/             # サービス単体テスト
│   └── support/              # テスト設定・ヘルパー
│
├── docs/                     # プロジェクトドキュメント
│
├── .github/                  # GitHub設定 (CI/CD, Templates)
│
├── terraform/                # インフラコード (AWS)
│
└── backend/                  # (Optional: モノレポ構成時のルート)
```

---

## 📂 主要ディレクトリの責務

### `app/services/` (Service Object)
コントローラーやモデルから複雑なビジネスロジックを切り出します。
1クラス1リポジトリ（`call` メソッドのみを持つ）を推奨します。

- **役割**: 
  - 複数のモデルにまたがる更新処理
  - 外部APIとの複雑な連携フロー
- **例**: `AiJudgeService`, `SpamDetector`, `OgpGenerator`

### `app/adapters/` (Adapter Pattern)
外部API（Gemini, OpenAI, GLM-4）への接続詳細を隠蔽し、インターフェースを統一します。
これにより、AIプロバイダーの変更や追加が容易になります。

- **役割**: 外部サービスのクライアントラッパー
- **例**: `GeminiAdapter`, `OpenaiAdapter`

### `app/prompts/`
AIに送信するプロンプト（指示書）をテキストファイルとして管理します。
ソースコードにハードコーディングせず、バージョン管理しやすくします。

- **役割**: プロンプトエンジニアリングの資産管理
- **例**: `hiroyuki.txt`, `dewi.txt`

### `spec/` (RSpec)
TDDの実践において最も重要なディレクトリです。

- **`spec/requests/`**: APIのエンドポイント（Controller）をテストします。ステータスコード、レスポンスボディ、DBの副作用を検証します。
- **`spec/factories/`**: テストデータを簡単に生成するための定義です。`FactoryBot`を使用します。
- **`spec/support/`**: テストの共通設定です。DynamoDB Localの起動設定や、WebMockの設定などを記述します。

---

## 🧱 アーキテクチャルール

### 1. Controllers are Skinny
コントローラーは「HTTP受け付け」「Service呼び出し」「JSON返し」のみを行います。ロジックは書きません。

### 2. Models are for Data Integrity
モデル（Dynamoid）は「データの定義」「バリデーション」「単純なクエリ」のみを担当します。複雑な業務ロジックはServiceへ。

### 3. TDD First
新機能追加時は、まず `spec/requests/` または `spec/services/` を書いてから実装を始めます。

---

## 🔗 関連資料
- [db_schema.md](./db_schema.md): データベース設計
- [screen_design.md](./screen_design.md): 画面設計
- [Gemfile.md](./Gemfile.md): ライブラリ選定理由
