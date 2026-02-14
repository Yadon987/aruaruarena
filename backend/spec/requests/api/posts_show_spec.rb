require 'rails_helper'

RSpec.describe 'GET /api/posts/:id', type: :request do
  before do
    Post.delete_all
    Judgment.delete_all
  end

  describe '正常系' do
    it '審査完了した投稿（status=scored, 3人全員成功）の詳細を取得できる' do
      post = create(:post, :scored, nickname: '太郎', body: 'スヌーズ押して二度寝', average_score: 85.3, judges_count: 3)
      create(:judgment, :hiroyuki, post_id: post.id, total_score: 85)
      create(:judgment, :dewi, post_id: post.id, total_score: 88)
      create(:judgment, :nakao, post_id: post.id, total_score: 83)

      get "/api/posts/#{post.id}"

      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json['id']).to eq(post.id)
      expect(json['nickname']).to eq('太郎')
      expect(json['body']).to eq('スヌーズ押して二度寝')
      expect(json['average_score']).to eq(85.3)
      expect(json['status']).to eq('scored')
      expect(json['judges_count']).to eq(3)
      expect(json['rank']).to eq(1)
      expect(json['total_count']).to eq(1)
      expect(json['judgments'].length).to eq(3)
    end

    it '審査中の投稿（status=judging, 審査完了0件）の詳細を取得できる' do
      post = create(:post, status: 'judging', judges_count: 0)

      get "/api/posts/#{post.id}"

      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json['status']).to eq('judging')
      expect(json['judges_count']).to eq(0)
      expect(json['judgments']).to eq([])
      expect(json['rank']).to be_nil
      expect(json['average_score']).to be_nil
    end

    it '審査中の投稿（status=judging, 一部審査完了）の詳細を取得できる' do
      post = create(:post, status: 'judging', judges_count: 1)
      create(:judgment, :hiroyuki, post_id: post.id)

      get "/api/posts/#{post.id}"

      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json['status']).to eq('judging')
      expect(json['judges_count']).to eq(1)
      expect(json['judgments'].length).to eq(1)
      expect(json['judgments'].first['persona']).to eq('hiroyuki')
      expect(json['rank']).to be_nil
      expect(json['average_score']).to be_nil
    end

    it '審査失敗した投稿（status=failed）の詳細を取得できる' do
      post = create(:post, :failed, judges_count: 1)
      create(:judgment, :hiroyuki, post_id: post.id, succeeded: true)
      create(:judgment, :dewi, :failed, post_id: post.id, error_code: 'timeout')
      create(:judgment, :nakao, :failed, post_id: post.id, error_code: 'provider_error')

      get "/api/posts/#{post.id}"

      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json['status']).to eq('failed')

      # 失敗した審査結果の検証
      dewi = json['judgments'].find { |j| j['persona'] == 'dewi' }
      expect(dewi['succeeded']).to be false
      expect(dewi['error_code']).to eq('timeout')
      expect(dewi['empathy']).to be_nil
      expect(dewi['total_score']).to be_nil
    end

    it '一部の審査員のみ成功した投稿（succeeded混在）の詳細を取得できる' do
      post = create(:post, status: 'failed', judges_count: 2)
      create(:judgment, :hiroyuki, post_id: post.id, succeeded: true, total_score: 80)
      create(:judgment, :dewi, :failed, post_id: post.id, error_code: 'timeout')
      create(:judgment, :nakao, post_id: post.id, succeeded: true, total_score: 90)

      get "/api/posts/#{post.id}"

      expect(response).to have_http_status(:ok)
      json = response.parsed_body

      # 成功した審査員の検証
      hiroyuki = json['judgments'].find { |j| j['persona'] == 'hiroyuki' }
      expect(hiroyuki['succeeded']).to be true
      expect(hiroyuki['total_score']).to eq(80)
      expect(hiroyuki['error_code']).to be_nil

      # 失敗した審査員の検証
      dewi = json['judgments'].find { |j| j['persona'] == 'dewi' }
      expect(dewi['succeeded']).to be false
      expect(dewi['error_code']).to eq('timeout')
      expect(dewi['total_score']).to be_nil
    end
  end

  describe '異常系' do
    it '存在しない投稿IDの場合404 NOT_FOUNDを返す' do
      non_existent_id = SecureRandom.uuid

      get "/api/posts/#{non_existent_id}"

      expect(response).to have_http_status(:not_found)
      json = response.parsed_body
      expect(json['error']).to eq('投稿が見つかりません')
      expect(json['code']).to eq('NOT_FOUND')
    end

    it '不正なUUID形式の場合404 NOT_FOUNDを返す' do
      invalid_ids = ['abc', '123', 'invalid-uuid', 'not-a-uuid-at-all']

      invalid_ids.each do |invalid_id|
        get "/api/posts/#{invalid_id}"
        expect(response).to have_http_status(:not_found)
        json = response.parsed_body
        expect(json['code']).to eq('NOT_FOUND')
      end
    end
  end

  describe '境界値' do
    it '唯一の投稿（順位1位）の詳細を取得できる' do
      post = create(:post, :scored, average_score: 85.0)
      create(:judgment, :hiroyuki, post_id: post.id)
      create(:judgment, :dewi, post_id: post.id)
      create(:judgment, :nakao, post_id: post.id)

      get "/api/posts/#{post.id}"

      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json['rank']).to eq(1)
      expect(json['total_count']).to eq(1)
    end

    it '同点の投稿が複数存在する場合created_atの早い方が上位になる' do
      # 固定のタイムスタンプを使用（Flakyテスト回避）
      earlier_timestamp = Time.zone.parse('2023-11-15 10:00:00').to_i.to_s
      later_timestamp = Time.zone.parse('2023-11-15 10:00:10').to_i.to_s

      # 1つ目の投稿（早い）
      post1 = create(:post, :scored,
        average_score: 85.0,
        created_at: earlier_timestamp
      )
      create(:judgment, :hiroyuki, post_id: post1.id, total_score: 85)
      create(:judgment, :dewi, post_id: post1.id, total_score: 85)
      create(:judgment, :nakao, post_id: post1.id, total_score: 85)

      # 2つ目の投稿（遅い、同点）
      post2 = create(:post, :scored,
        average_score: 85.0,
        created_at: later_timestamp
      )
      create(:judgment, :hiroyuki, post_id: post2.id, total_score: 85)
      create(:judgment, :dewi, post_id: post2.id, total_score: 85)
      create(:judgment, :nakao, post_id: post2.id, total_score: 85)

      # 早い投稿は1位
      get "/api/posts/#{post1.id}"
      expect(response.parsed_body['rank']).to eq(1)
      expect(response.parsed_body['total_count']).to eq(2)

      # 遅い投稿は2位
      get "/api/posts/#{post2.id}"
      expect(response.parsed_body['rank']).to eq(2)
      expect(response.parsed_body['total_count']).to eq(2)
    end

    it 'average_scoreが0.0の投稿（最低点）の詳細を取得できる' do
      post = create(:post, :scored, average_score: 0.0)
      create(:judgment, :hiroyuki, post_id: post.id, total_score: 0)
      create(:judgment, :dewi, post_id: post.id, total_score: 0)
      create(:judgment, :nakao, post_id: post.id, total_score: 0)

      get "/api/posts/#{post.id}"

      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json['average_score']).to eq(0.0)
      expect(json['rank']).to be_present
    end

    it 'average_scoreが100.0の投稿（満点）の詳細を取得できる' do
      post = create(:post, :scored, average_score: 100.0)
      create(:judgment, :hiroyuki, post_id: post.id, total_score: 100)
      create(:judgment, :dewi, post_id: post.id, total_score: 100)
      create(:judgment, :nakao, post_id: post.id, total_score: 100)

      get "/api/posts/#{post.id}"

      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json['average_score']).to eq(100.0)
      expect(json['rank']).to eq(1) # 最高点なので1位
    end
  end
end
