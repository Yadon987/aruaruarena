# SimpleCov設定ファイル
# カバレッジ90%以上を要求

SimpleCov.start 'rails' do
  # カバレッジの最低ラインを90%に設定
  minimum_coverage 90

  # ファイルごとの最低カバレッジ（80%以上）
  minimum_coverage_by_file 80

  # カバレッジが閾値を下回った場合にテストを失敗させる
  refuse_coverage_drop

  # フィルタ設定
  add_filter '/bin/'
  add_filter '/db/'
  add_filter '/spec/'
  add_filter '/test/'
  add_filter '/config/'
  add_filter '/vendor/'

  # グループ設定
  add_group 'Controllers', 'app/controllers'
  add_group 'Models', 'app/models'
  add_group 'Services', 'app/services'
  add_group 'Adapters', 'app/adapters'
  add_group 'Libraries', 'lib'

  # マージしたくないディレクトリを指定
  merge_timeout 3600
end
