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

    it '日本語描画にはDroid Sans Fallbackを優先すること' do
      expect(described_class::FONT_PATH_CANDIDATES).to include(described_class::SYSTEM_NOTO_CJK_FONT_PATH.to_s)
      expect(described_class::FONT_PATH_CANDIDATES).to include(described_class::SYSTEM_DROID_FONT_PATH.to_s)
      expect(described_class::FONT_BOLD_PATH_CANDIDATES)
        .to include(described_class::SYSTEM_NOTO_CJK_BOLD_FONT_PATH.to_s)
      expect(described_class::NUMBER_FONT_PATH).to eq(described_class::SYSTEM_NUMBER_FONT_PATH)
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
  end

  describe 'E20 RED: execute' do
    let(:post) do
      instance_double(
        Post,
        id: 'post-id',
        status: Post::STATUS_SCORED,
        nickname: '太郎',
        body: 'あるある本文',
        average_score: 85.5,
        calculate_rank: 11,
        created_at: Time.current
      )
    end
    let(:service) { described_class.new('post-id') }

    before do
      allow(Post).to receive(:find).with('post-id').and_return(post)

      setup_image_mocks
      setup_draw_mocks
      setup_file_exist_mocks
    end

    # 何を検証するか: スコア済み投稿ならPNGバイナリを返すこと
    it 'スコア済み投稿ではPNGバイナリを返すこと' do
      expect(service.execute).to start_with("\x89PNG")
    end

    # 何を検証するか: 審査員描画を廃止した後はdraw_judgmentsメソッド自体が削除されていること
    it 'draw_judgmentsメソッドが削除されていること' do
      expect(described_class.private_instance_methods(false)).not_to include(:draw_judgments)
    end

    # 何を検証するか: 本文1行+ニックネーム+順位数字/接尾辞+点数数字/接尾辞+フッターの7要素で描画されること
    it '審査員結果が存在してもdraw_textは7回だけ呼ばれること' do
      redraw_service = described_class.new('post-id')
      expect(redraw_service).to receive(:draw_text).exactly(7).times.and_call_original

      redraw_service.execute
    end

    # 何を検証するか: 順位数字が主文言として描画されること
    it '総合スコア画像に11が描画されること' do
      allow(service).to receive(:draw_text).and_call_original
      expect(service).to receive(:draw_text)
        .with(anything, hash_including(
                          text: '11',
                          size: be_between(described_class::MIN_FONT_SIZES[:rank_number],
                                           described_class::FONT_SIZES[:rank_number]),
                          color: described_class::TEXT_COLORS[:rank],
                          y: described_class::LAYOUT[:rank_number][:y],
                          font: described_class::NUMBER_FONT_PATH
                        ))
        .and_call_original

      service.execute
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
  end

  describe 'E20 REFACTOR: 補強テスト' do
    let(:post) do
      instance_double(
        Post,
        id: 'post-id',
        status: Post::STATUS_SCORED,
        nickname: "太郎\r\n次郎",
        body: "本文\n続き",
        average_score: nil,
        calculate_rank: 11,
        created_at: Time.current
      )
    end
    let(:service) { described_class.new('post-id') }

    before do
      allow(Post).to receive(:find).with('post-id').and_return(post)
      setup_image_mocks
      setup_draw_mocks
      setup_file_exist_mocks
    end

    # 何を検証するか: 改行コードの違いに関係なく描画前に半角スペースへ正規化されること
    it 'sanitize_textがLFとCRLFを半角スペースへ置換すること' do
      expect(service.send(:sanitize_text, "a\nb\r\nc")).to eq('a b c')
    end

    # 何を検証するか: ImageMagick向けのエスケープ処理がバックスラッシュとシングルクォートを維持すること
    it 'escape_single_quotesがバックスラッシュとシングルクォートをエスケープすること' do
      expect(service.send(:escape_single_quotes, "a'b")).to eq("a\\'b")
      expect(service.send(:escape_single_quotes, 'a\\b')).to eq('a\\\\b')
    end

    # 何を検証するか: nilスコアでも0.0表記になること
    it 'average_scoreがnilでも0.0で描画されること' do
      allow(service).to receive(:draw_text).and_call_original
      expect(service).to receive(:draw_text)
        .with(anything, hash_including(
                          text: '0.0',
                          size: be_between(described_class::MIN_FONT_SIZES[:score_number],
                                           described_class::FONT_SIZES[:score_number]),
                          color: described_class::TEXT_COLORS[:score],
                          y: described_class::LAYOUT[:score_number][:y],
                          font: described_class::NUMBER_FONT_PATH
                        ))
        .and_call_original

      service.execute
    end

    # 何を検証するか: scored以外の投稿やnil投稿は生成対象外のままであること
    it 'valid_post相当のnilとステータスガードが維持されること' do
      failed_post = instance_double(Post, status: Post::STATUS_FAILED)
      judging_post = instance_double(Post, status: Post::STATUS_JUDGING)

      allow(Post).to receive(:find).with('missing-id').and_raise(Dynamoid::Errors::RecordNotFound.new('not found'))
      allow(Post).to receive(:find).with('failed-id').and_return(failed_post)
      allow(Post).to receive(:find).with('judging-id').and_return(judging_post)

      expect(described_class.call('missing-id')).to be_nil
      expect(described_class.call('failed-id')).to be_nil
      expect(described_class.call('judging-id')).to be_nil
    end
  end
end
