---
name: E10-04 Warmup Processing
about: ウォームアップ処理（Thread.new）の実装（TDD準拠）
title: '[SPEC] E10-04 Warmup Processing'
labels: 'spec, e10'
assignees: ''
---

## 📋 概要

審査完了時にThread.newでOGP画像生成をトリガーし、CloudFrontキャッシュを事前に生成する。

## 🎯 目的

- 最初のSNSシェア時にOGP画像がキャッシュされていない状態を回避する
- CloudFrontキャッシュヒット率を向上させ、ユーザー体験を改善する

## 📝 詳細仕様

### 機能要件

1. **ウォームアップタイミング**
   - 審査完了時（`status` が `scored` になった時）
   - `JudgePostService` の `update_post_status!` 後に実行

2. **Thread処理**
   - `Thread.new` でOGP画像生成をトリガー
   - 例外処理をThread内で実行（メインスレッドへの影響を防ぐ）

3. **完了待機**
   - 最大0.5秒でThread完了待機（`thread.join(0.5)`）
   - タイムアウト時はThreadを強制終了しない（バックグラウンドで完了を待つ）

### 非機能要件

- メインスレッドへの影響を最小限に抑える
- 例外発生時も審査処理を続行する

## 🔧 技術仕様

### クラス変更（JudgePostService）

```ruby
class JudgePostService
  # 既存の定数...

  # ウォームアップ最大待機時間（秒）
  OGP_WARMUP_TIMEOUT = 0.5

  def execute
    return if @post.nil?

    # ... 既存の審査ロジック

    save_judgments!(results)
    update_post_status!

    # 審査完了時にOGP画像をウォームアップ
    warmup_ogp_image if @post.status == Post::STATUS_SCORED
  rescue StandardError => e
    # ... 既存の例外処理
  ensure
    @executor&.shutdown
  end

  private

  # ... 既存のprivateメソッド

  # OGP画像のウォームアップ（審査完了時）
  def warmup_ogp_image
    return if @post.nil? || @post.status != Post::STATUS_SCORED

    warmup_thread = Thread.new do
      begin
        OgpGeneratorService.call(@post.id)
        Rails.logger.info("[JudgePostService] OGP warmup completed: post_id=#{@post.id}")
      rescue StandardError => e
        Rails.logger.warn("[JudgePostService] OGP warmup failed: post_id=#{@post.id}, error=#{e.class} - #{e.message}")
      end
    end

    # 最大0.5秒待機
    warmup_thread.join(OGP_WARMUP_TIMEOUT)
  ensure
    # 0.5秒経過してもThreadが完了していない場合、強制終了はしない
  end
end
```

### Thread処理の仕組み

```
メインスレッド
  ├─ 審査処理（JudgePostService.execute）
  ├─ 審査結果保存（save_judgments!）
  ├─ ステータス更新（update_post_status!）
  ├─ ウォームアップ開始（warmup_ogp_image）
  │  └─ Thread.new → OgpGeneratorService.call（バックグラウンド）
  ├─ 最大0.5秒待機（thread.join(0.5)）
  └─ レスポンス返却

バックグラウンドスレッド
  ├─ OgpGeneratorService.call（OGP画像生成）
  └─ CloudFrontキャッシュ更新
```

## 🧪 テスト計画 (TDD)

### Service Spec (JudgePostService)

```ruby
# spec/services/judge_post_service_spec.rb（追加）
RSpec.describe JudgePostService do
  describe 'OGP画像のウォームアップ' do
    let!(:post) { create(:post) }

    context '正常系 (Happy Path)' do
      it '審査完了時にOGP画像生成がトリガーされること' do
        expect(OgpGeneratorService).to receive(:call).with(post.id)

        mock_adapter_judge(GeminiAdapter, success: true)
        mock_adapter_judge(DewiAdapter, success: true)
        mock_adapter_judge(OpenAiAdapter, success: true)

        service = described_class.new(post.id)
        service.execute

        post.reload
        expect(post.status).to eq('scored')
      end

      it 'Threadが最大0.5秒で完了を待機すること' do
        start_time = Time.now

        thread = Thread.new do
          sleep 0.1
        end

        thread.join(0.5)

        expect(Time.now - start_time).to be < 0.6
        expect(thread.alive?).to be false
      end
    end

    context '異常系 (Error Path)' do
      it 'OGP画像生成失敗時も審査処理は続行されること' do
        allow(OgpGeneratorService).to receive(:call).and_raise(StandardError.new('OGP generation failed'))

        mock_adapter_judge(GeminiAdapter, success: true)
        mock_adapter_judge(DewiAdapter, success: true)
        mock_adapter_judge(OpenAiAdapter, success: true)

        service = described_class.new(post.id)
        service.execute

        post.reload
        expect(post.status).to eq('scored')
      end

      it 'failed状態の投稿ではウォームアップが実行されないこと' do
        expect(OgpGeneratorService).not_to receive(:call)

        mock_adapter_judge(GeminiAdapter, success: false)
        mock_adapter_judge(DewiAdapter, success: false)
        mock_adapter_judge(OpenAiAdapter, success: false)

        service = described_class.new(post.id)
        service.execute

        post.reload
        expect(post.status).to eq('failed')
      end
    end
  end
end
```

## ✅ 受入条件 (AC) - Given-When-Then

### 正常系 (Happy Path)

- **Given**: 3人の審査員が全員成功する
- **When**: 審査処理を実行する
- **Then**: `OgpGeneratorService.call(post.id)` が呼び出される
- **And**: 投稿のステータスが`scored`になる
- **And**: Threadが最大0.5秒で完了する

### 異常系 (Error Path)

- **Given**: OGP画像生成で例外が発生する
- **When**: 審査処理を実行する
- **Then**: 審査処理は続行される
- **And**: 投稿のステータスが`scored`になる
- **And**: ログに警告が出力される

- **Given**: 審査が失敗する（status: failed）
- **When**: 審査処理を実行する
- **Then**: `OgpGeneratorService.call` は呼び出されない

## 🔗 関連資料

- `backend/app/services/judge_post_service.rb`: 変更対象ファイル
- `backend/app/services/ogp_generator_service.rb`: OGP画像生成サービス
- `backend/spec/services/judge_post_service_spec.rb`: テストファイル

## レビュアーへの確認事項

- [ ] Thread.newでOGP画像生成がトリガーされている
- [ ] Thread内で例外処理が実装されている
- [ ] 最大0.5秒でThread完了待機が実装されている
- [ ] failed状態の投稿ではウォームアップが実行されない
- [ ] OGP画像生成失敗時も審査処理が続行される
- [ ] サービススペックがすべて通過している
