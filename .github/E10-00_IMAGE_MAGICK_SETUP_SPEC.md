---
name: E10-00 ImageMagick Setup
about: DockerfileへのImageMagick追加（TDD準拠）
title: '[SPEC] E10-00 ImageMagick Setup'
labels: 'spec, e10'
assignees: ''
---

## 📋 概要

OGP画像生成のために、DockerfileにImageMagickパッケージを追加する。

## 🎯 目的

- mini_magick gemが利用可能なImageMagick環境を構築する
- OGP画像生成機能（E10-01〜E10-05）の前提条件を満たす

## 📝 詳細仕様

### 機能要件
- DockerfileのbaseステージにImageMagickパッケージを追加する
- インストール後、RubyプロセスからImageMagickコマンドが実行可能であること

### 非機能要件
- Dockerイメージサイズの増加を最小限に抑える（aptキャッシュ削除）

## 🔧 技術仕様

### Dockerfile変更内容

```dockerfile
# baseステージのapt-get installにimagemagickを追加
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y curl libjemalloc2 imagemagick && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives
```

## 🧪 テスト計画 (TDD)

### Unit Test (Service)

```ruby
# spec/services/ogp_generator_service_spec.rb
RSpec.describe OgpGeneratorService do
  describe 'ImageMagickが使用可能であること' do
    it 'ImageMagickがインストールされていること' do
      # 実際の実装ではシステムコマンドなどで確認するか、MiniMagickが動くことを確認
      expect(system('convert -version')).to be true
    end
  end
end
```

## ✅ 受入条件 (AC) - Given-When-Then

### 正常系 (Happy Path)

- **Given**: Dockerfileが変更されている
- **When**: `docker build -t aruaruarena-backend .` を実行する
- **Then**: ビルドが成功し、ImageMagickがインストールされている

- **Given**: インストールされたDockerイメージを実行している
- **When**: `convert -version` コマンドを実行する
- **Then**: ImageMagickのバージョン情報が表示される

### 異常系 (Error Path)

該当なし（パッケージインストールのみ）

## 🔗 関連資料

- `backend/Dockerfile`: 変更対象ファイル
- `backend/Gemfile`: mini_magick gem（既に含まれている）

## レビュアーへの確認事項

- [ ] aptキャッシュ削除が実装されている
- [ ] `--no-install-recommends` フラグが使用されている
- [ ] ImageMagickバージョン確認テストが追加されている
- [ ] Dockerイメージサイズが適切である
