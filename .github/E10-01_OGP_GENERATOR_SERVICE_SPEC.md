---
name: E10-01 OgpGeneratorService
about: OGP画像生成サービスの実装（TDD準拠）
title: '[SPEC] E10-01 OgpGeneratorService'
labels: 'spec, e10'
assignees: ''
---

## 📋 概要

投稿内容・審査結果に基づいて、OGP画像を動的生成するサービスオブジェクトを実装する。

## 🎯 目的

- SNSシェア時に表示されるOGP画像を動的に生成する
- 投稿内容（ニックネーム・本文）・平均点・ランキング順位・審査員スコア・コメントを表示する

## 📝 詳細仕様

### 機能要件

1. **サービスオブジェクト構造**
   - `OgpGeneratorService.call(post_id)` クラスメソッド
   - 初期化時にPostを取得、見つからない場合はnilを返す
   - `judging` / `failed` 状態の投稿はnilを返す
   - `scored` 状態の投稿のみOGP画像を生成

2. **画像構成**
   - 画像サイズ: 1200x630 (OGP推奨サイズ)
   - 表示内容:
     - ニックネーム（1-20文字）
     - 本文（3-30文字）
     - 平均点（0-100）
     - ランキング順位（第X位）
     - 審査員ごとのスコア・コメント（3人分）

3. **審査員カラーコード**
   - `hiroyuki`: #4A90E2（青）
   - `dewi`: #F5A623（橙）
   - `nakao`: #D0021B（赤）

### 非機能要件

- エラーハンドリング: Post取得失敗時は例外をスローせず、nilを返す
- 画像生成失敗時は例外をログ出力し、nilを返す

## 🔧 技術仕様

### データモデル

**Postモデルから取得する属性:**
```ruby
{
  id: String (UUID),
  nickname: String (1-20文字),
  body: String (3-30文字),
  average_score: Float (0-100),
  status: String (judging/scored/failed),
  rank: Integer (ランキング順位)
}
```

**Judgmentモデルから取得する属性:**
```ruby
{
  persona: String (hiroyuki/dewi/nakao),
  succeeded: Boolean,
  total_score: Integer (0-100),
  comment: String (審査コメント)
}
```

### クラスインターフェース

```ruby
class OgpGeneratorService
  # ImageMagickがインストールされているかの真偽値
  MAGICK_AVAILABLE = true  # 環境に応じて動的に設定すること

  IMAGE_WIDTH = 1200
  IMAGE_HEIGHT = 630
  IMAGE_FORMAT = 'PNG'

  JUDGE_COLORS = {
    'hiroyuki' => '#4A90E2',
    'dewi' => '#F5A623',
    'nakao' => '#D0021B'
  }.freeze

  BASE_IMAGE_PATH = Rails.root.join('app', 'assets', 'images', 'base_ogp.png')
  JUDGE_ICON_PATHS = {
    'hiroyuki' => Rails.root.join('app', 'assets', 'images', 'judge_hiroyuki.png'),
    'dewi' => Rails.root.join('app', 'assets', 'images', 'judge_dewi.png'),
    'nakao' => Rails.root.join('app', 'assets', 'images', 'judge_nakao.png')
  }.freeze

  def initialize(post_id)
    @post = Post.find(post_id)
    @judgments = Judgment.where(post_id: post_id).to_a
  rescue Dynamoid::Errors::RecordNotFound, Dynamoid::Errors::MissingHashKey
    Rails.logger.warn("[OgpGeneratorService] Post not found: #{post_id}")
    @post = nil
  end

  def execute
    return nil if @post.nil?
    return nil if @post.status != Post::STATUS_SCORED

    # 画像生成ロジック
  end

  class << self
    def call(post_id)
      new(post_id).execute
    end
  end
end
```

### API設計

なし（サービスオブジェクトのみ）

## 🧪 テスト計画 (TDD)

### Unit Test (Service)

```ruby
# spec/services/ogp_generator_service_spec.rb
RSpec.describe OgpGeneratorService do
  describe '定数' do
    it '画像サイズ定数が定義されていること' do
      expect(described_class::IMAGE_WIDTH).to eq(1200)
      expect(described_class::IMAGE_HEIGHT).to eq(630)
    end

    it '審査員カラーコードが定義されていること' do
      expect(described_class::JUDGE_COLORS).to include(
        'hiroyuki' => '#4A90E2',
        'dewi' => '#F5A623',
        'nakao' => '#D0021B'
      )
    end
  end

  describe '.call' do
    let(:post) { create(:post, :scored) }

    context '正常系 (Happy Path)' do
      it 'scored状態の投稿のOGP画像を生成できること' do
        create_list(:judgment, 3, post_id: post.id)
        image = described_class.call(post.id)
        expect(image).not_to be_nil
        expect(image.format).to eq('PNG')
      end

      it '投稿内容が画像に反映されていること' do
        post = create(:post, :scored, nickname: '太郎', body: 'スヌーズ押して二度寝')
        create_list(:judgment, 3, post_id: post.id)
        image = described_class.call(post.id)
        expect(image).not_to be_nil
      end
    end

    context '異常系 (Error Path)' do
      it 'judging状態の投稿はnilを返すこと' do
        post.update(status: 'judging')
        image = described_class.call(post.id)
        expect(image).to be_nil
      end

      it 'failed状態の投稿はnilを返すこと' do
        post.update(status: 'failed')
        image = described_class.call(post.id)
        expect(image).to be_nil
      end

      it '投稿が見つからない場合はnilを返すこと' do
        expect(Rails.logger).to receive(:warn).with(/Post not found/)
        result = described_class.call('nonexistent_id')
        expect(result).to be_nil
      end
    end
  end
end
```

## ✅ 受入条件 (AC) - Given-When-Then

### 正常系 (Happy Path)

- **Given**: scored状態の投稿が存在する
- **And**: 3人の審査員の結果が登録されている
- **When**: `OgpGeneratorService.call(post.id)` を実行する
- **Then**: MiniMagick::Imageオブジェクトが返る
- **And**: 画像サイズは1200x630である
- **And**: 画像フォーマットはPNGである

### 異常系 (Error Path)

- **Given**: 存在しないpost_idを指定する
- **When**: `OgpGeneratorService.call(post.id)` を実行する
- **Then**: nilが返る
- **And**: 例外は発生しない
- **And**: ログに警告が出力される

- **Given**: judging状態の投稿を指定する
- **When**: `OgpGeneratorService.call(post.id)` を実行する
- **Then**: nilが返る

## 🔗 関連資料

- `backend/app/services/ogp_generator_service.rb`: 実装対象ファイル
- `backend/app/models/post.rb`: 投稿モデル
- `backend/app/models/judgment.rb`: 審査結果モデル
- `backend/app/services/judge_post_service.rb`: サービスオブジェクト実装パターン参照
- `docs/db_schema.md`: DB設計

## レビュアーへの確認事項

- [ ] サービスオブジェクトのパターンが既存のJudgePostServiceと一貫している
- [ ] 審査員カラーコードが正しく定義されている
- [ ] Post取得失敗時のエラーハンドリングが適切
- [ ] judging/failed状態の投稿はnilを返す
- [ ] 画像パス定数が正しく設定されている
- [ ] 単体テストがすべて通過している
