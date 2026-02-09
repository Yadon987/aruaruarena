# frozen_string_literal: true

namespace :dynamodb do
  desc 'DynamoDBテーブルの一覧を表示'
  task list_tables: :environment do
    tables = Dynamoid.adapter.list_tables
    puts '=== DynamoDB Tables ==='
    tables.each { |table| puts "  - #{table}" }
    puts "Total: #{tables.count} tables"
  end

  desc 'テスト用データを投入'
  task seed: :environment do
    require 'faker'

    puts 'テストデータ作成中...'

    # サンプル投稿作成
    10.times do |i|
      post = Post.create!(
        id: SecureRandom.uuid,
        nickname: Faker::Name.first_name,
        body: %w[スヌーズ押して二度寝 上司のメール既読スルー 仕事中にYouTube開く][i % 3],
        status: 'scored',
        average_score: rand(60.0..95.0).round(1),
        judges_count: 3,
        created_at: Time.now.to_i - (i * 3600)
      )

      # score_keyを設定
      post.update_attribute(:score_key, post.generate_score_key)

      # 審査結果作成
      %w[hiroyuki dewi nakao].each do |persona|
        Judgment.create!(
          post_id: post.id,
          persona: persona,
          id: SecureRandom.uuid,
          succeeded: true,
          empathy: rand(10..20),
          humor: rand(10..20),
          brevity: rand(10..20),
          originality: rand(10..20),
          expression: rand(10..20),
          total_score: rand(60..100),
          comment: 'これは面白い！',
          judged_at: Time.now.to_i
        )
      end

      puts "  作成: #{post.nickname} - #{post.body}"
    end

    puts '✅ テストデータ作成完了'
  end

  desc '全テーブルのデータを削除（注意: テーブル自体は残ります）'
  task truncate: :environment do
    print '全データを削除します。よろしいですか？ (yes/no): '
    return unless $stdin.gets.chomp == 'yes'

    tables = Dynamoid.adapter.list_tables

    tables.each do |table|
      puts "  Deleting data from #{table}..."
      # 各モデルに対応するテーブルを削除
      case table
      when 'aruaruarena-posts'
        Post.find_each(&:delete)
      when 'aruaruarena-judgments'
        Judgment.find_each(&:delete)
      when 'aruaruarena-rate-limits'
        RateLimit.find_each(&:delete)
      when 'aruaruarena-duplicate-checks'
        DuplicateCheck.find_each(&:delete)
      else
        puts '    (skipped: unknown table)'
      end
    end

    puts '✅ 全データ削除完了'
  end

  desc '統計情報を表示'
  task stats: :environment do
    puts '=== DynamoDB Stats ==='

    # Posts
    posts_count = Post.count
    scored_count = Post.where('status EQ ?', 'scored').count
    puts "Posts: #{posts_count} (scored: #{scored_count})"

    # Judgments
    judgments_count = Judgment.count
    succeeded_count = Judgment.where('succeeded EQ ?', true).count
    puts "Judgments: #{judgments_count} (succeeded: #{succeeded_count})"

    # Rate Limits
    rate_limits_count = RateLimit.count
    puts "Rate Limits: #{rate_limits_count}"

    # Duplicate Checks
    duplicate_checks_count = DuplicateCheck.count
    puts "Duplicate Checks: #{duplicate_checks_count}"
  end

  desc '全投稿のランキングを再計算'
  task recalculate_rankings: :environment do
    puts 'ランキング再計算中...'

    posts = Post.where('status EQ ?', 'scored').to_a
    posts.each do |post|
      post.update_attribute(:score_key, post.generate_score_key)
      puts "  Updated: #{post.id} (score: #{post.average_score})"
    end

    puts "✅ #{posts.count} 件の投稿を更新しました"
  end
end
