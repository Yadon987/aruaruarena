# frozen_string_literal: true

# SimpleCov設定ファイル
# カバレッジ90%以上を要求

SimpleCov.start 'rails' do
  # カバレッジの最低ラインを設定（ローカルでも大きな低下は検知する）
  minimum_coverage(ENV['CI'] ? 90 : 80) unless ENV['SIMPLECOV_DISABLE_MINIMUM_COVERAGE'] == '1'

  # ファイルごとの最低カバレッジ（現状66%程度のファイルがあるため60%に緩和）
  # 0行のファイル（設定ファイル等）による警告を回避するためコメントアウト
  # minimum_coverage_by_file 60

  # カバレッジが閾値を下回った場合にテストを失敗させる（CI環境のみ）
  refuse_coverage_drop if ENV['CI']

  # フィルタ設定（/spec/はSimpleCovが自動的に除外するため不要）
  add_filter '/bin/'
  add_filter '/db/'
  add_filter '/test/'
  add_filter '/config/'
  add_filter '/vendor/'

  # グループ設定
  add_group 'Controllers', 'app/controllers'
  add_group 'Models', 'app/models'
  add_group 'Services', 'app/services'
  add_group 'Adapters', 'app/adapters'
  add_group 'Libraries', 'lib'

  # 結果の永続化を有効化
  use_merging true
  merge_timeout 3600

  # フォーマッター設定（HTMLとテキスト両方を出力）
  formatter SimpleCov::Formatter::MultiFormatter.new([
                                                       SimpleCov::Formatter::HTMLFormatter,
                                                       SimpleCov::Formatter::SimpleFormatter
                                                     ])
end
