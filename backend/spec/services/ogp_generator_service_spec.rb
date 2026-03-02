# frozen_string_literal: true

require 'rails_helper'

RSpec.describe OgpGeneratorService, dynamodb: false do
  include OgpTestHelpers

  describe 'E20 RED: 定数整理' do
    # 何を検証するか: OGP画像の出力サイズが1200x630のまま維持されること
    it '画像サイズ定数が1200x630で定義されていること' do
      expect(described_class::IMAGE_WIDTH).to eq(1200)
      expect(described_class::IMAGE_HEIGHT).to eq(630)
    end

    # 何を検証するか: OGP画像の出力フォーマットがPNGで定義されていること
    it '画像フォーマット定数がPNGで定義されていること' do
      expect(described_class::IMAGE_FORMAT).to eq('PNG')
    end

    # 何を検証するか: シンプル化により審査員カラー定数が削除されていること
    it 'JUDGE_COLORS定数が削除されていること' do
      expect(described_class.constants).not_to include(:JUDGE_COLORS)
    end

    # 何を検証するか: シンプル化により審査員アイコン定数が削除されていること
    it 'JUDGE_ICON_PATHS定数が削除されていること' do
      expect(described_class.constants).not_to include(:JUDGE_ICON_PATHS)
    end

    # 何を検証するか: レイアウト定数から審査員描画用の設定が削除されていること
    it 'LAYOUT定数に審査員関連キーが含まれないこと' do
      expect(described_class::LAYOUT.keys).not_to include(
        :judges_start_y, :judges_x_offset, :judges_y_step,
        :icon, :judge_score_y_offset, :judge_comment_y_offset, :judge_text_x_offset
      )
    end

    # 何を検証するか: フォントサイズ定数から審査員描画用の設定が削除されていること
    it 'FONT_SIZES定数に審査員関連キーが含まれないこと' do
      expect(described_class::FONT_SIZES.keys).not_to include(:judge_score, :judge_comment)
    end
  end

  describe 'E20 RED: 初期化処理' do
    # 何を検証するか: 審査員描画を廃止するため初期化時にJudgment一覧を読み込まないこと
    it '初期化時に投稿のjudgmentsを読み込まないこと' do
      post = instance_double(Post)

      allow(Post).to receive(:find).with('post-id').and_return(post)
      expect(post).not_to receive(:judgments)

      described_class.new('post-id')
    end

    it 'Postオブジェクトを直接受け取る場合は再取得しないこと' do
      post = double('Post')
      allow(post).to receive(:is_a?).with(Post).and_return(true)

      expect(Post).not_to receive(:find)

      described_class.new(post)
    end
  end

  describe 'E20 RED: execute' do
    let(:post) do
      instance_double(
        Post,
        id: 'post-id',
        status: Post::STATUS_SCORED,
        nickname: '太郎',
        body: 'あるある本文',
        average_score: 85.5
      )
    end
    let(:service) { described_class.new('post-id') }

    before do
      allow(Post).to receive(:find).with('post-id').and_return(post)
      allow(LogOgpGenerationEventService).to receive(:call)

      setup_image_mocks
      setup_draw_mocks
      setup_file_exist_mocks
    end

    # 何を検証するか: スコア済み投稿ならPNGバイナリを返すこと
    it 'スコア済み投稿ではPNGバイナリを返すこと' do
      expect(service.execute).to start_with("\x89PNG")
      expect(LogOgpGenerationEventService).to have_received(:call).with(
        event: 'ogp_generation_succeeded',
        post:
      )
    end

    # 何を検証するか: 審査員描画を廃止した後はdraw_judgmentsメソッド自体が削除されていること
    it 'draw_judgmentsメソッドが削除されていること' do
      expect(described_class.private_instance_methods(false)).not_to include(:draw_judgments)
    end

    # 何を検証するか: 描画処理はニックネーム・本文・スコアの3回だけで完結すること
    it 'draw_textは3回だけ呼ばれること' do
      redraw_service = described_class.new('post-id')
      expect(redraw_service).to receive(:draw_text).exactly(3).times.and_call_original

      redraw_service.execute
    end

    # 何を検証するか: スコア表示は小数第1位付きで描画されること
    it '総合スコアが85.5点として描画されること' do
      allow(service).to receive(:draw_text).and_call_original
      expect(service).to receive(:draw_text)
        .with(anything, '85.5点', described_class::FONT_SIZES[:score], described_class::TEXT_COLORS[:score],
              described_class::LAYOUT[:score][:x], described_class::LAYOUT[:score][:y], described_class::FONT_BOLD_PATH)
        .and_call_original

      service.execute
    end

    # 何を検証するか: average_score=nilでも0.0点でフォールバックして描画すること
    it 'average_scoreがnilのときは0.0点が描画されること' do
      allow(post).to receive(:average_score).and_return(nil)
      allow(service).to receive(:draw_text).and_call_original
      expect(service).to receive(:draw_text)
        .with(anything, '0.0点', described_class::FONT_SIZES[:score], described_class::TEXT_COLORS[:score],
              described_class::LAYOUT[:score][:x], described_class::LAYOUT[:score][:y], described_class::FONT_BOLD_PATH)
        .and_call_original

      service.execute
    end
  end

  describe 'sanitize_text' do
    it '絵文字を除去してOGP描画用テキストへ変換すること' do
      service = described_class.allocate

      sanitized = service.send(:sanitize_text, "あるある😀\n次の行")

      expect(sanitized).to eq('あるある 次の行')
    end

    it '日本語を保持すること' do
      service = described_class.allocate

      sanitized = service.send(:sanitize_text, 'あいうえお')

      expect(sanitized).to eq('あいうえお')
    end

    it 'ASCII数字を保持すること' do
      service = described_class.allocate

      sanitized = service.send(:sanitize_text, '100点')

      expect(sanitized).to eq('100点')
    end
  end

  describe 'E20 RED: 異常系' do
    # 何を検証するか: 投稿が見つからない場合はnilを返して処理を中断すること
    it '存在しない投稿IDではnilを返すこと' do
      allow(Post).to receive(:find).with('missing-id').and_raise(Dynamoid::Errors::RecordNotFound.new('not found'))

      expect(described_class.call('missing-id')).to be_nil
    end

    # 何を検証するか: scoring前の投稿はOGP画像を生成しないこと
    it 'judging状態の投稿ではnilを返すこと' do
      post = instance_double(Post, status: Post::STATUS_JUDGING)

      allow(Post).to receive(:find).with('judging-id').and_return(post)

      expect(described_class.call('judging-id')).to be_nil
    end

    # 何を検証するか: 審査失敗の投稿はOGP画像を生成しないこと
    it 'failed状態の投稿ではnilを返すこと' do
      post = instance_double(Post, status: Post::STATUS_FAILED)

      allow(Post).to receive(:find).with('failed-id').and_return(post)

      expect(described_class.call('failed-id')).to be_nil
    end

    # 何を検証するか: ベース画像が欠けている場合はnilを返して処理を中断すること
    it 'ベース画像が存在しない場合はnilを返すこと' do
      post = instance_double(
        Post,
        id: 'post-id',
        status: Post::STATUS_SCORED,
        nickname: '太郎',
        body: 'あるある本文',
        average_score: 85.5
      )
      allow(Post).to receive(:find).with('post-id').and_return(post)
      service = described_class.new('post-id')
      setup_file_exist_mocks
      allow(File).to receive(:exist?).with(described_class::BASE_IMAGE_PATH.to_s).and_return(false)

      expect(service.execute).to be_nil
    end

    # 何を検証するか: フォントファイルが欠けている場合はnilを返して処理を中断すること
    it 'フォントファイルが存在しない場合はnilを返すこと' do
      post = instance_double(
        Post,
        id: 'post-id',
        status: Post::STATUS_SCORED,
        nickname: '太郎',
        body: 'あるある本文',
        average_score: 85.5
      )
      allow(Post).to receive(:find).with('post-id').and_return(post)
      service = described_class.new('post-id')
      setup_file_exist_mocks
      allow(File).to receive(:exist?).with(described_class::FONT_PATH.to_s).and_return(false)

      expect(service.execute).to be_nil
    end

    # 何を検証するか: ベース画像欠損時に成功ログを出力しないこと
    it 'ベース画像が存在しない場合は成功ログを出力しないこと' do
      post = instance_double(
        Post,
        id: 'post-id',
        status: Post::STATUS_SCORED,
        nickname: '太郎',
        body: 'あるある本文',
        average_score: 85.5
      )
      allow(Post).to receive(:find).with('post-id').and_return(post)
      allow(LogOgpGenerationEventService).to receive(:call)
      setup_file_exist_mocks
      allow(File).to receive(:exist?).with(described_class::BASE_IMAGE_PATH.to_s).and_return(false)

      described_class.call('post-id')

      expect(LogOgpGenerationEventService).not_to have_received(:call).with(
        hash_including(event: 'ogp_generation_succeeded')
      )
    end
  end
end
