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

    it '日本語描画は利用可能なシステムフォントを優先し、数字は同梱フォントを使用すること' do
      expect(described_class::FONT_PATH_CANDIDATES).to include(described_class::SYSTEM_NOTO_CJK_FONT_PATH.to_s)
      expect(described_class::FONT_PATH_CANDIDATES).to include(described_class::SYSTEM_DROID_FONT_PATH.to_s)
      expect(described_class::FONT_PATH.exist?).to be(true)
      expect(described_class::FONT_BOLD_PATH.exist?).to be(true)
      expect(described_class::NUMBER_FONT_PATH).to eq(described_class::SYSTEM_NUMBER_FONT_PATH)
    end

    it '描画に使用するフォント実体が存在すること' do
      expect(described_class::FONT_PATH.exist?).to be(true)
      expect(described_class::FONT_BOLD_PATH.exist?).to be(true)
      expect(described_class::NUMBER_FONT_PATH.exist?).to be(true)
    end

    it '日本語描画用フォント候補を優先順で保持すること' do
      expect(described_class::SYSTEM_DROID_FONT_PATH.to_s).to include('DroidSansFallbackFull.ttf')
      expect(described_class::SYSTEM_NOTO_CJK_FONT_PATH.to_s).to include('NotoSansCJK-Regular.ttc')
      expect(described_class::SYSTEM_NOTO_CJK_BOLD_FONT_PATH.to_s).to include('NotoSansCJK-Bold.ttc')
      expect(described_class::SYSTEM_NUMBER_FONT_PATH.to_s).to include('DejaVuSans-Bold.ttf')
      expect(described_class::BUNDLED_JP_FONT_PATH).to eq(
        Rails.root.join('app/assets/fonts/NotoSansJP-Regular.otf')
      )
      expect(described_class::BUNDLED_JP_BOLD_FONT_PATH).to eq(
        Rails.root.join('app/assets/fonts/NotoSansJP-Bold.otf')
      )
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
        average_score: 85.5,
        calculate_rank: 11
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

    # 何を検証するか: 本文1行+ニックネーム+順位数字/接尾辞+点数数字/接尾辞+フッターの7要素で描画されること
    it 'draw_textは7回だけ呼ばれること' do
      redraw_service = described_class.new('post-id')
      expect(redraw_service).to receive(:draw_text).exactly(7).times.and_call_original

      redraw_service.execute
    end

    # 何を検証するか: 順位数字が独立した主文言として大きく描画されること
    it '11が主文言として描画されること' do
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

    # 何を検証するか: ニックネームが独立ラベルとして描画されること
    it 'ニックネーム入りのラベルが描画されること' do
      allow(service).to receive(:draw_text).and_call_original
      expect(service).to receive(:draw_text)
        .with(anything, hash_including(
                          text: '投稿者  太郎',
                          size: be_between(described_class::MIN_FONT_SIZES[:nickname],
                                           described_class::FONT_SIZES[:nickname]),
                          color: described_class::TEXT_COLORS[:nickname],
                          y: described_class::LAYOUT[:nickname][:y],
                          font: described_class::FONT_PATH
                        ))
        .and_call_original

      service.execute
    end

    # 何を検証するか: average_score=nilでも0.0点表記へフォールバックすること
    it 'average_scoreがnilのときは0.0点が描画されること' do
      allow(post).to receive(:average_score).and_return(nil)
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

    # 何を検証するか: 順位未確定時に「ランク集計中」を単独ラベルとして描画し「位」を付けないこと
    it 'rankがnilのときはランク集計中を単独描画すること' do
      allow(post).to receive(:calculate_rank).and_return(nil)
      allow(service).to receive(:draw_text).and_call_original
      expect(service).to receive(:draw_text)
        .with(anything, hash_including(
                          text: 'ランク集計中',
                          color: described_class::TEXT_COLORS[:rank],
                          y: described_class::LAYOUT[:rank_pending][:y],
                          font: described_class::FONT_BOLD_PATH
                        ))
        .and_call_original
      expect(service).not_to receive(:draw_text).with(anything, hash_including(text: '位'))

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

  describe 'escape_single_quotes' do
    it 'バッククォートをエスケープすること' do
      service = described_class.allocate

      escaped = service.send(:escape_single_quotes, '危険`文字列')

      expect(escaped).to eq('危険\\`文字列')
    end

    it 'バッククォートとシングルクォートが混在してもエスケープすること' do
      service = described_class.allocate

      escaped = service.send(:escape_single_quotes, "危険'`文字列")

      expect(escaped).to eq("危険\\'\\`文字列")
    end
  end

  describe 'text_draw_command' do
    it '描画コマンド生成時にサニタイズとエスケープをまとめて行うこと' do
      service = described_class.allocate

      command = service.send(:text_draw_command, "危険😀'`\n文字列", { x: 12, y: 34 })

      expect(command).to eq("text 12,34 '危険\\'\\` 文字列'")
    end
  end

  describe '日本語フォント描画' do
    let(:service) { described_class.allocate }

    it '日本語フォントで本文文字を描画できること' do
      original_crop = MiniMagick::Image.open(described_class::BASE_IMAGE_PATH)
      original_crop.crop('220x100+90+170')

      rendered_image = MiniMagick::Image.open(described_class::BASE_IMAGE_PATH)

      service.send(
        :apply_text_layer,
        rendered_image,
        {
          text: 'あるあるアリーナ',
          font: described_class::FONT_PATH,
          size: 44,
          stroke_width: 0,
          x: 96,
          y: 198
        },
        fill: described_class::TEXT_COLORS[:body],
        position: { x: 96, y: 198, stroke_width: 0 },
        stroke: 'transparent'
      )

      rendered_crop = rendered_image.clone
      rendered_crop.crop('220x100+90+170')

      expect(rendered_crop.signature).not_to eq(original_crop.signature)
    end
  end

  describe 'E20 REFACTOR: レイアウト計算' do
    let(:service) { described_class.allocate }

    it '長い本文を本文の最大行数以内に折り返し、末尾を省略すること' do
      text = '「朝起きた瞬間からもう一回寝られる理由を本気で探してしまい、布団の中で言い訳を量産しながら気づけばアラームを三回止めているあるあるです」'

      lines = service.send(
        :wrapped_lines,
        text,
        max_width: 420,
        font_size: 42,
        max_lines: described_class::BODY_MAX_LINES
      )

      expect(lines.length).to be <= described_class::BODY_MAX_LINES
      expect(lines.last).to end_with('...')
    end

    it '日本語本文は貪欲に詰め込みすぎず自然な位置で折り返すこと' do
      text = '「朝は眠いのに夜になると急に目がさえて布団の中で明日のことを考え始めてしまう」'

      lines = service.send(
        :wrapped_lines,
        text,
        max_width: 450,
        font_size: 38,
        max_lines: described_class::BODY_MAX_LINES
      )

      expect(lines).to eq(
        ['「朝は眠いのに夜になる', 'と急に目がさえて布団の', '中で明日のことを考え始', 'めてしまう」']
      )
    end

    it '順位ラベルは本番経路で順位数値と接尾辞に分かれて描画されること' do
      allow(service).to receive(:safe_rank).and_return(11)

      number_item, suffix_item = service.send(:build_rank_items)

      expect(number_item[:text]).to eq('11')
      expect(number_item[:y]).to eq(described_class::LAYOUT[:rank_number][:y])
      expect(suffix_item[:text]).to eq(described_class::TEXT_CONFIG[:rank_suffix])
      expect(suffix_item[:y]).to eq(described_class::LAYOUT[:rank_suffix][:y])
    end

    it '本文の行間は各行の縮小率に関わらず一定であること' do
      allow(service).to receive(:body_font_size).and_return(34)
      allow(service).to receive(:build_body_lines).with(font_size: 34).and_return(%w[短い本文 とても長くて縮小される本文])

      items = service.send(:build_body_items)

      expect(items.first[:y]).to eq(described_class::LAYOUT[:body][:y])
      expect(items.second[:y] - items.first[:y]).to eq(34 + described_class::BODY_LINE_SPACING)
      expect(items.pluck(:size)).to all(eq(34))
    end

    it '本文が縮小後サイズで4行以内に収まる場合は省略しないこと' do
      allow(service).to receive(:sanitized_body_text).and_return('本文テキスト')
      allow(service).to receive(:body_line_count) do |font_size|
        font_size > 34 ? 5 : 4
      end
      allow(service).to receive(:wrapped_lines) do |_text, max_width:, font_size:, max_lines:|
        expect(max_width).to eq(described_class::LAYOUT[:body][:max_width])
        expect(max_lines).to eq(described_class::BODY_MAX_LINES)

        if font_size == 34
          %w[1行目 2行目 3行目 4行目]
        else
          ['1行目', '2行目', '3行目', '4行目...']
        end
      end

      expect(service.send(:build_body_lines)).to eq(%w[1行目 2行目 3行目 4行目])
    end

    it '点数が広すぎる場合はフォントサイズを自動で縮小すること' do
      font_size = service.send(:fitted_font_size, :score_number, '100.0')

      expect(font_size).to be < described_class::FONT_SIZES[:score_number]
      expect(font_size).to be >= described_class::MIN_FONT_SIZES[:score_number]
      expect(service.send(:estimate_text_width, '100.0', font_size))
        .to be <= described_class::LAYOUT[:score_number][:max_width]
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
        average_score: 85.5,
        calculate_rank: 11
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
        average_score: 85.5,
        calculate_rank: 11
      )
      allow(Post).to receive(:find).with('post-id').and_return(post)
      service = described_class.new('post-id')
      setup_file_exist_mocks
      allow(File).to receive(:exist?).with(described_class::FONT_PATH.to_s).and_return(false)

      expect(service.execute).to be_nil
    end

    shared_examples '必須フォント欠損時はnilを返すこと' do |font_path|
      it "#{font_path} が存在しない場合はnilを返すこと" do
        allow(File).to receive(:exist?).with(font_path.to_s).and_return(false)

        expect(service.execute).to be_nil
      end
    end

    context '必須フォントが欠損しているとき' do
      let(:post) do
        instance_double(
          Post,
          id: 'post-id',
          status: Post::STATUS_SCORED,
          nickname: '太郎',
          body: 'あるある本文',
          average_score: 85.5,
          calculate_rank: 11
        )
      end
      let(:service) { described_class.new('post-id') }

      before do
        allow(Post).to receive(:find).with('post-id').and_return(post)
        setup_file_exist_mocks
      end

      it_behaves_like '必須フォント欠損時はnilを返すこと', described_class::NUMBER_FONT_PATH
      it_behaves_like '必須フォント欠損時はnilを返すこと', described_class::FONT_BOLD_PATH
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
