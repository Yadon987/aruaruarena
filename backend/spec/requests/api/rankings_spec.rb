# frozen_string_literal: true

require 'rails_helper'

# E08 ランキングAPIのテスト
# GET /api/rankings エンドポイントの受け入れ基準を検証
RSpec.describe 'GET /api/rankings', type: :request do
  before do
    # テストデータのクリーンアップ
    Post.delete_all
    Judgment.delete_all
  end

  describe '正常系' do
    # テスト1: ステータス200でTOP20がスコア降順で返される
    # 検証: スコア降順、TOP20制限、各フィールド確認
    it 'ステータス200でTOP20がスコア降順で返される' do
      # テストデータ作成（スコアの異なる3件）
      create(:post, :scored, average_score: 90.0, nickname: '1位')
      create(:post, :scored, average_score: 80.0, nickname: '2位')
      create(:post, :scored, average_score: 70.0, nickname: '3位')

      get '/api/rankings'

      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      rankings = json['rankings']

      expect(rankings.length).to eq(3)
      expect(rankings[0]['nickname']).to eq('1位')
      expect(rankings[0]['rank']).to eq(1)
      expect(rankings[1]['nickname']).to eq('2位')
      expect(rankings[1]['rank']).to eq(2)
      expect(rankings[2]['nickname']).to eq('3位')
      expect(rankings[2]['rank']).to eq(3)
    end

    # テスト2: scored投稿のみが返される（judging/failed除外）
    # 検証: ステータスフィルタ、total_count
    it 'scored投稿のみが返される（judging/failed除外）' do
      create(:post, :scored, average_score: 80.0)
      create(:post, status: 'judging')
      create(:post, :failed)

      get '/api/rankings'

      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json['rankings'].length).to eq(1)
      expect(json['total_count']).to eq(1)
    end
  end

  describe '異常系' do
    # テスト3: DynamoDBエラー時500エラーレスポンス
    # 検証: エラーフォーマット確認
    it 'DynamoDBエラー時500エラーレスポンスが返される' do
      # DynamoDBへの接続エラーを模倣
      allow(Post).to receive(:top_rankings).and_raise(
        Aws::DynamoDB::Errors::ServiceError.new(
          Seahorse::Client::RequestContext.new,
          'Error'
        )
      )

      get '/api/rankings'

      expect(response).to have_http_status(:internal_server_error)
      json = response.parsed_body
      expect(json['error']).to eq('サーバーエラーが発生しました')
      expect(json['code']).to eq('INTERNAL_ERROR')
    end
  end

  describe '境界値' do
    # テスト4: scored投稿0件で空配列とtotal_count: 0
    # 検証: 空レスポンス確認
    it 'scored投稿0件で空配列とtotal_count: 0が返される' do
      get '/api/rankings'

      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json['rankings']).to eq([])
      expect(json['total_count']).to eq(0)
    end

    # テスト5: scored投稿20件で全件返す（rank 1-20）
    # 検証: 20件境界
    it 'scored投稿20件で全件返される（rank 1〜20）' do
      20.times do |i|
        create(:post, :scored, average_score: 10.0 + i)
      end

      get '/api/rankings'

      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json['rankings'].length).to eq(20)
      expect(json['total_count']).to eq(20)
      expect(json['rankings'].last['rank']).to eq(20)
    end

    # テスト6: scored投稿25件でTOP20のみ返す
    # 検証: 21件以上除外、total_count=25
    it 'scored投稿25件でTOP20のみ返される' do
      25.times do |i|
        create(:post, :scored, average_score: 10.0 + i)
      end

      get '/api/rankings'

      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json['rankings'].length).to eq(20)
      expect(json['total_count']).to eq(25)
    end

    # テスト7: 同点スコアでcreated_at早い方が上位
    # 検証: タイブレーク順序、連番rank
    it '同点スコアでcreated_at早い方が上位になる' do
      # 同点スコアを作成（作成日時に差をつける）
      # 注意: created_atはUnixTimestampの文字列表現
      create(:post, :scored, average_score: 90.0, created_at: '1700000002', nickname: '新しい（下位）')
      create(:post, :scored, average_score: 90.0, created_at: '1700000001', nickname: '古い（上位）')

      get '/api/rankings'

      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json['rankings'][0]['nickname']).to eq('古い（上位）')
      expect(json['rankings'][0]['rank']).to eq(1)
      expect(json['rankings'][1]['nickname']).to eq('新しい（下位）')
      expect(json['rankings'][1]['rank']).to eq(2)
    end

    # テスト8: スコア100.0がrank:1、0.0が下位
    # 検証: スコア範囲境界
    it 'スコア100.0がrank:1、0.0が下位になる' do
      create(:post, :scored, average_score: 100.0, nickname: '満点')
      create(:post, :scored, average_score: 0.0, nickname: '0点')
      create(:post, :scored, average_score: 50.0, nickname: '中間')

      get '/api/rankings'

      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json['rankings'][0]['nickname']).to eq('満点')
      expect(json['rankings'].last['nickname']).to eq('0点')
    end
  end

  describe 'レスポンス構造' do
    # テスト9: JSONのキー名・型が仕様通り
    # 検証: 型チェック、キー存在確認
    it 'レスポンスのJSON構造が仕様通りである' do
      create(:post, :scored, average_score: 95.5, nickname: '太郎', body: 'スヌーズ押して二度寝')

      get '/api/rankings'

      expect(response).to have_http_status(:ok)
      json = response.parsed_body

      # トップレベルのキー確認
      expect(json).to have_key('rankings')
      expect(json).to have_key('total_count')

      # rankings配列の要素構造確認
      ranking = json['rankings'].first
      expect(ranking).to have_key('rank')
      expect(ranking).to have_key('id')
      expect(ranking).to have_key('nickname')
      expect(ranking).to have_key('body')
      expect(ranking).to have_key('average_score')

      # 型確認
      expect(ranking['rank']).to be_a(Integer)
      expect(ranking['id']).to be_a(String)
      expect(ranking['nickname']).to be_a(String)
      expect(ranking['body']).to be_a(String)
      expect(ranking['average_score']).to be_a(Float)
    end
  end
end
