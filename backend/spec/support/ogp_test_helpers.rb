# frozen_string_literal: true

# OGP画像生成テスト用モックヘルパー
module OgpTestHelpers
  # 何を検証するか: ベース画像のモックオブジェクトを生成する
  def mock_base_image
    @mock_base_image ||= double('MiniMagick::Image')
  end

  # 何を検証するか: 描画コマンドのモックオブジェクトを生成する
  def mock_draw
    @mock_draw ||= double('MiniMagick::CommandBuilder')
  end

  # 何を検証するか: PNGバイナリ（正しいシグネチャ付き）を生成する
  def mock_png_binary
    # PNGシグネチャ: 89 50 4E 47 0D 0A 1A 0A
    # rubocop:disable Style/StringConcatenation
    "\x89PNG\r\n\x1A\n" + ('a' * 100)
    # rubocop:enable Style/StringConcatenation
  end

  # 何を検証するか: MiniMagick画像処理のモックを設定する
  # rubocop:disable Metrics/AbcSize
  def setup_image_mocks
    allow(MiniMagick::Image).to receive(:open).and_return(mock_base_image)
    allow(mock_base_image).to receive(:width).and_return(1200)
    allow(mock_base_image).to receive(:height).and_return(630)
    allow(mock_base_image).to receive(:composite).and_return(mock_base_image)
    allow(mock_base_image).to receive(:combine_options).and_yield(mock_draw)
    allow(mock_base_image).to receive(:to_blob).and_return(mock_png_binary)
    allow(mock_base_image).to receive(:format).and_return('PNG')
  end
  # rubocop:enable Metrics/AbcSize

  # 何を検証するか: 描画コマンドのモックを設定する
  # rubocop:disable Metrics/AbcSize
  def setup_draw_mocks
    allow(mock_draw).to receive(:font).and_return(nil)
    allow(mock_draw).to receive(:fill).and_return(nil)
    allow(mock_draw).to receive(:pointsize).and_return(nil)
    allow(mock_draw).to receive(:gravity).and_return(nil)
    allow(mock_draw).to receive(:draw).and_return(nil)
    allow(mock_draw).to receive(:annotate).and_return(nil)
  end
  # rubocop:enable Metrics/AbcSize

  # 何を検証するか: ファイル存在チェックのモックを設定する
  # rubocop:disable Metrics/AbcSize
  def setup_file_exist_mocks
    # まずデフォルト動作を設定
    allow(File).to receive(:exist?).and_call_original

    # 既知のパスに対して個別にモックをオーバーライド
    allow(File).to receive(:exist?).with(OgpGeneratorService::BASE_IMAGE_PATH.to_s).and_return(true)
    allow(File).to receive(:exist?).with(OgpGeneratorService::FONT_PATH.to_s).and_return(true)
    allow(File).to receive(:exist?).with(OgpGeneratorService::FONT_BOLD_PATH.to_s).and_return(true)
  end

  # フォントファイルが存在しないモックを設定する
  def setup_font_file_not_exist_mock
    setup_file_exist_mocks
    allow(File).to receive(:exist?).with(OgpGeneratorService::FONT_PATH.to_s).and_return(false)
  end
  # rubocop:enable Metrics/AbcSize

  # 何を検証するか: ランキング計算のモックを設定する
  def setup_rank_mock(rank = 1)
    allow_any_instance_of(Post).to receive(:calculate_rank).and_return(rank)
  end

  # DynamoDBスロットリングエラーのモックを設定する
  def setup_dynamodb_throttling_mock(error_class = Aws::DynamoDB::Errors::ProvisionedThroughputExceededException)
    allow(DuplicateCheck).to receive(:check).and_raise(error_class.new(nil, 'Throttling error'))
    allow(DuplicateCheck).to receive(:register).and_raise(error_class.new(nil, 'Throttling error'))
  end

  # Post#calculate_rankの例外を設定する
  def setup_calculate_rank_error(error_class = Aws::DynamoDB::Errors::ServiceError)
    allow_any_instance_of(Post).to receive(:calculate_rank).and_raise(error_class.new(nil, 'DB error'))
  end
end

RSpec.configure do |config|
  config.include OgpTestHelpers, type: :service
  config.include OgpTestHelpers, type: :request
end
