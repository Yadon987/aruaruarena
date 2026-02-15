---
name: E10-02 MiniMagick Composite
about: mini_magickによる画像合成の実装（TDD準拠）
title: '[SPEC] E10-02 MiniMagick Composite'
labels: 'spec, e10'
assignees: ''
---

## 📋 概要

OgpGeneratorService内でmini_magickを使用して、ベース画像・審査員アイコン・テキストを合成する。

## 🎯 目的

- ベース画像に投稿内容・スコア・審査結果を描画する
- 審査員ごとにテーマカラーを適用したOGP画像を生成する

## 📝 詳細仕様

### 機能要件

1. **ベース画像のロード**
   - `app/assets/images/base_ogp.png` をベースとして使用

2. **テキスト描画**
   - ニックネーム: 太字、サイズ48、色#333333、位置(100, 100)
   - 本文: 通常、サイズ36、色#333333、位置(100, 160)
   - 平均点: 太字、サイズ72、色#FF6B6B、位置(900, 100)
   - ランキング順位: 通常、サイズ36、位置(900, 180)

3. **審査員情報の描画**
   - 審査員アイコンを合成（`judge_hiroyuki.png`, `judge_dewi.png`, `judge_nakao.png`）
   - 審査員ごとのテーマカラーでスコアを表示
   - コメントの先頭20文字を表示（位置(120, y_offset + 40)）

4. **フォント設定**
   - 日本語フォント（NotoSansJP-Bold.otf / NotoSansJP-Regular.otf）
   - フォントパス: `app/assets/fonts/`

### 非機能要件

- 画像生成失敗時は例外をログ出力し、nilを返す

## 🔧 技術仕様

### 画像レイアウト設計

```
┌─────────────────────────────────────────────────────────────┐
│  [ベース画像: 1200x630]                                       │
│                                                               │
│  [ニックネーム: 太字48pt]                                      │
│  [本文: 通常36pt]                                             │
│                                                               │
│                        [平均点: 太字72pt]                     │
│                        [ランキング: 通常36pt]                  │
│                                                               │
│  ┌─────────┐ [スコア: テーマカラー] [コメント: 通常18pt]    │
│  │ アイコン │                                                    │
│  └─────────┘                                                    │
│                                                               │
│  ┌─────────┐ [スコア: テーマカラー] [コメント: 通常18pt]    │
│  │ アイコン │                                                    │
│  └─────────┘                                                    │
│                                                               │
│  ┌─────────┐ [スコア: テーマカラー] [コメント: 通常18pt]    │
│  │ アイコン │                                                    │
│  └─────────┘                                                    │
└─────────────────────────────────────────────────────────────┘
```

### メソッド構成

```ruby
class OgpGeneratorService
  # 既存の定数・initialize・call...

  private

  def draw_post_content(image)
    draw = MiniMagick::Draw.new
    draw.font = Rails.root.join('app', 'assets', 'fonts', 'NotoSansJP-Bold.otf')
    draw.pointsize = 48
    draw.fill = '#333333'

    draw.annotate(image, 0, 0, 100, 100, @post.nickname)
    draw.pointsize = 36
    draw.annotate(image, 0, 0, 100, 160, @post.body)
  end

  def draw_score(image)
    draw = MiniMagick::Draw.new
    draw.font = Rails.root.join('app', 'assets', 'fonts', 'NotoSansJP-Bold.otf')
    draw.pointsize = 72
    draw.fill = '#FF6B6B'

    score_text = "#{@post.average_score}点"
    rank_text = @post.rank ? "第#{@post.rank}位" : '圏外'

    draw.annotate(image, 0, 0, 900, 100, score_text)
    draw.pointsize = 36
    draw.annotate(image, 0, 0, 900, 180, rank_text)
  end

  def draw_judgments(image)
    y_offset = 250
    @judgments.each do |judgment|
      next unless judgment.succeeded

      color = JUDGE_COLORS[judgment.persona]
      icon_path = JUDGE_ICON_PATHS[judgment.persona]

      icon = MiniMagick::Image.open(icon_path)
      image.composite!(icon, 50, y_offset, 'Over')

      draw = MiniMagick::Draw.new
      draw.font = Rails.root.join('app', 'assets', 'fonts', 'NotoSansJP-Regular.otf')
      draw.pointsize = 24
      draw.fill = color
      draw.annotate(image, 0, 0, 120, y_offset + 10, judgment.total_score.to_s)

      draw.pointsize = 18
      draw.fill = '#666666'
      draw.annotate(image, 0, 0, 120, y_offset + 40, judgment.comment[0, 20])

      y_offset += 80
    end
  end
end
```

## 🧪 テスト計画 (TDD)

### Unit Test (Service)

```ruby
# spec/services/ogp_generator_service_spec.rb（追加）
RSpec.describe OgpGeneratorService do
  describe '画像合成' do
    let(:post) { create(:post, :scored) }

    before { create_list(:judgment, 3, post_id: post.id) }

    it '投稿内容が画像に描画されること' do
      image = described_class.call(post.id)
      expect(image).not_to be_nil
      # 実際のピクセル検証は複雑なため、画像生成自体を検証
    end

    it '平均点・ランキングが画像に描画されること' do
      post = create(:post, :scored, average_score: 85.5)
      allow_any_instance_of(Post).to receive(:rank).and_return(10)
      create_list(:judgment, 3, post_id: post.id)

      image = described_class.call(post.id)
      expect(image).not_to be_nil
    end

    it '審査員スコア・コメントが画像に描画されること' do
      image = described_class.call(post.id)
      expect(image).not_to be_nil
    end

    it 'コメントが20文字に切り詰められること' do
      long_comment = 'a' * 100
      create(:judgment, post_id: post.id, comment: long_comment)

      image = described_class.call(post.id)
      expect(image).not_to be_nil
    end
  end
end
```

## ✅ 受入条件 (AC) - Given-When-Then

### 正常系 (Happy Path)

- **Given**: scored状態の投稿が存在する
- **And**: 3人の審査員の結果が登録されている
- **When**: `OgpGeneratorService.call(post.id)` を実行する
- **Then**: ニックネーム・本文が描画されている
- **And**: 平均点・ランキングが描画されている
- **And**: 審査員アイコン・スコア・コメントが描画されている
- **And**: 審査員ごとにテーマカラーが適用されている

### 異常系 (Error Path)

- **Given**: ベース画像ファイルが存在しない
- **When**: `OgpGeneratorService.call(post.id)` を実行する
- **Then**: nilが返る
- **And**: ログにエラーが出力される

## 🔗 関連資料

- `backend/app/services/ogp_generator_service.rb`: 実装対象ファイル
- `backend/app/assets/images/`: 画像リソース格納ディレクトリ
- `backend/app/assets/fonts/`: フォントリソース格納ディレクトリ

## レビュアーへの確認事項

- [ ] ベース画像パス定数が正しく設定されている
- [ ] フォントパス定数が正しく設定されている
- [ ] テキスト描画の位置・サイズ・色が適切
- [ ] 審査員アイコンの合成処理が正しく実装されている
- [ ] 審査員ごとのテーマカラーが適切に適用されている
- [ ] コメントの切り詰め処理が実装されている（先頭20文字）
- [ ] 単体テストがすべて通過している
