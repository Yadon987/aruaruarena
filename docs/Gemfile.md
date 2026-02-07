# Gemfile 設計書

## 📦 使用Gem一覧

### Core & Networking
| Gem | バージョン | 用途 |
|:---|:---|:---|
| rails | ~> 8.0.0 | Webフレームワーク |
| puma | >= 5.0 | アプリケーションサーバー |
| bootsnap | - | 起動高速化 |
| rack-cors | - | CORS設定（クロスドメインアクセス許可） |
| faraday | - | HTTPクライアント（AI API呼び出し） |
| parallel | - | 並列処理（3人の審査員を同時呼び出し） |

### Database (DynamoDB)
| Gem | バージョン | 用途 |
|:---|:---|:---|
| dynamoid | ~> 3.11 | DynamoDB ORM |
| aws-sdk-dynamodb | - | AWS SDK |

### Image Processing
| Gem | バージョン | 用途 |
|:---|:---|:---|
| mini_magick | - | OGP画像生成（ImageMagickラッパー） |

### Utilities
| Gem | バージョン | 用途 |
|:---|:---|:---|
| tzinfo-data | - | タイムゾーンデータ（Windows/JRuby用） |

---

## 🧪 Development & Test

### Development + Test
| Gem | バージョン | 用途 |
|:---|:---|:---|
| debug | - | デバッガー |
| pry-rails | - | 高機能コンソール |
| rspec-rails | ~> 8.0 | テストフレームワーク |
| factory_bot_rails | - | テストデータ作成 |
| faker | - | ダミーデータ生成 |
| rubocop | ~> 1.69 | コードフォーマッター/Linter（ベース） |
| rubocop-rails | ~> 2.27 | Rails用Lint（2025年版） |
| rubocop-rspec | ~> 3.3 | RSpec用Lint（TDD品質向上） |
| rubocop-rspec_rails | ~> 2.30 | RSpec + Rails用Lint |
| brakeman | ~> 6.1 | セキュリティスキャン |
| bundler-audit | ~> 0.9 | Gem脆弱性チェック |
| dotenv-rails | - | 環境変数管理（.envファイル読み込み） |

### Test Only
| Gem | バージョン | 用途 |
|:---|:---|:---|
| simplecov | - | テストカバレッジ計測 |
| shoulda-matchers | - | RSpecマッチャー拡張 |
| webmock | - | HTTPリクエストのモック |
| vcr | - | APIレスポンスの記録・再生 |
| rspec_junit_formatter | ~> 0.6 | CI連携（JUnit形式出力） |

---

## ❌ 採用しなかったGem

| Gem | 理由 |
|:---|:---|
| bullet | DynamoDB (Dynamoid) に未対応のため |
| capybara | APIモードのため（E2EはPlaywrightで代替） |
| sidekiq / redis | `parallel` gemで同期並列処理するため不要 |
| anthropic | 今回はClaude（Anthropic）を使わないため |
| unicode | Ruby標準の `String#unicode_normalize` で十分 |
| annotate | Dynamoidでは動作しない可能性が高い |
| jwt | 認証なし（匿名投稿）のため不要 |
| kaminari / pagy | ページネーション不要（TOP20固定） |
| timecop | Rails標準の `travel_to` で代替可能 |

---

## ✅ 互換性確認済み

| 組み合わせ | 結果 |
|:---|:---:|
| Rails 8.0 + dynamoid 3.11 | ✅ |
| Rails 8.0 + rspec-rails 8.x | ✅ |
| Rails 8.0 + rubocop-rails 2.27 | ✅ |
| faraday + webmock | ✅ |
| pry-rails + debug | ✅（共存可能） |
| rubocop + rubocop-rspec | ✅ |

---

## 📝 Gemfile（コピペ用）

```ruby
source "https://rubygems.org"
git_source(:github) { |repo| "https://github.com/#{repo}.git" }

# =============================================================================
# Core
# =============================================================================
gem "rails", "~> 8.0.0"
gem "puma", ">= 5.0"
gem "bootsnap", require: false

# =============================================================================
# API & Network
# =============================================================================
gem "rack-cors"
gem "faraday"
gem "parallel"

# =============================================================================
# Database (DynamoDB)
# =============================================================================
gem "dynamoid", "~> 3.11"
gem "aws-sdk-dynamodb"

# =============================================================================
# Image Processing
# =============================================================================
gem "mini_magick"

# =============================================================================
# Utilities
# =============================================================================
gem "tzinfo-data", platforms: %i[ windows jruby ]

# =============================================================================
# Development & Test
# =============================================================================
group :development, :test do
  # Debugging
  gem "debug", platforms: %i[ mri windows ]
  gem "pry-rails"

  # Testing Framework
  gem "rspec-rails", "~> 8.0"
  gem "factory_bot_rails"
  gem "faker"

  # Code Quality (2025年版)
  gem "rubocop", "~> 1.69"
  gem "rubocop-rails", "~> 2.27"
  gem "rubocop-rspec", "~> 3.3"
  gem "rubocop-rspec_rails", "~> 2.30"

  # Security
  gem "brakeman", "~> 6.1"
  gem "bundler-audit", "~> 0.9"

  # Environment
  gem "dotenv-rails"
end

# =============================================================================
# Test Only
# =============================================================================
group :test do
  # Coverage
  gem "simplecov", require: false

  # Matchers & Mocks
  gem "shoulda-matchers"
  gem "webmock"
  gem "vcr"

  # CI Integration
  gem "rspec_junit_formatter", "~> 0.6"
end
```

---

## 🔧 セットアップ手順

```bash
# Gemインストール
bundle install

# RSpec初期化
bundle exec rails generate rspec:install

# RuboCop初期設定
bundle exec rubocop --init
```

---

## 📋 .rubocop.yml 推奨設定

```yaml
require:
  - rubocop-rails
  - rubocop-rspec
  - rubocop-rspec_rails

AllCops:
  TargetRubyVersion: 3.2
  NewCops: enable
  Exclude:
    - 'db/**/*'
    - 'vendor/**/*'
    - 'node_modules/**/*'

# 1行の長さ
Layout/LineLength:
  Max: 120

# メソッドの長さ
Metrics/MethodLength:
  Max: 15

# クラスの長さ
Metrics/ClassLength:
  Max: 100

# RSpec: describeのネスト深度
RSpec/NestedGroups:
  Max: 4
```
