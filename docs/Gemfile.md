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
| Gem | 用途 |
|:---|:---|
| debug | デバッガー |
| pry-rails | 高機能コンソール |
| rspec-rails (~> 8.0) | テストフレームワーク |
| factory_bot_rails | テストデータ作成 |
| faker | ダミーデータ生成 |
| rubocop-rails | コードフォーマッター/Linter |
| dotenv-rails | 環境変数管理（.envファイル読み込み） |

### Test Only
| Gem | 用途 |
|:---|:---|
| simplecov | テストカバレッジ計測 |
| shoulda-matchers | RSpecマッチャー拡張 |
| webmock | HTTPリクエストのモック |
| vcr | APIレスポンスの記録・再生 |

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

---

## ✅ 互換性確認済み

| 組み合わせ | 結果 |
|:---|:---:|
| Rails 8.0 + dynamoid 3.11 | ✅ |
| Rails 8.0 + rspec-rails 8.x | ✅ |
| faraday + webmock | ✅ |
| pry-rails + debug | ✅（共存可能） |

---

## 📝 Gemfile（コピペ用）

```ruby
source "https://rubygems.org"

# Core
gem "rails", "~> 8.0.0"
gem "puma", ">= 5.0"
gem "bootsnap", require: false

# API & Network
gem "rack-cors"
gem "faraday"
gem "parallel"

# Database (DynamoDB)
gem "dynamoid", "~> 3.11"
gem "aws-sdk-dynamodb"

# Image Processing
gem "mini_magick"

# Utilities
gem "tzinfo-data", platforms: %i[ windows jruby ]

group :development, :test do
  gem "debug", platforms: %i[ mri windows ]
  gem "pry-rails"
  gem "rspec-rails", "~> 8.0"
  gem "factory_bot_rails"
  gem "faker"
  gem "rubocop-rails"
  gem "dotenv-rails"
end

group :test do
  gem "simplecov", require: false
  gem "shoulda-matchers"
  gem "webmock"
  gem "vcr"
end
```
