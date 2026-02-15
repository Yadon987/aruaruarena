# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'POST /api/posts/:id/rejudge', type: :request do
  before do
    Post.delete_all
    Judgment.delete_all
  end

  let(:headers) { { 'Content-Type' => 'application/json' } }
  let(:success_result) do
    BaseAiAdapter::JudgmentResult.new(
      succeeded: true,
      error_code: nil,
      scores: { empathy: 15, humor: 15, brevity: 15, originality: 15, expression: 15 },
      comment: '再審査成功'
    )
  end

  describe '正常系 (Happy Path)' do
    # 何を検証するか: dewiのみ再審査成功でstatusがscoredになること
    it 'failed投稿でdewiのみ再審査すると200とscoredを返す' do
      post_record = create(:post, :failed, judges_count: 1)
      create(:judgment, :hiroyuki, post_id: post_record.id, succeeded: true, total_score: 80)
      create(:judgment, :dewi, :failed, post_id: post_record.id, error_code: 'timeout')
      allow_any_instance_of(DewiAdapter).to receive(:judge).and_return(success_result)

      params = { failed_personas: ['dewi'] }
      post "/api/posts/#{post_record.id}/rejudge", params: params.to_json, headers: headers

      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json['id']).to eq(post_record.id)
      expect(json['status']).to eq('scored')
    end

    # 何を検証するか: dewiとnakaoの再審査成功でstatusがscoredになること
    it 'failed投稿でdewiとnakaoを再審査すると200とscoredを返す' do
      post_record = create(:post, :failed, judges_count: 1)
      create(:judgment, :hiroyuki, post_id: post_record.id, succeeded: true, total_score: 78)
      create(:judgment, :dewi, :failed, post_id: post_record.id, error_code: 'timeout')
      create(:judgment, :nakao, :failed, post_id: post_record.id, error_code: 'provider_error')
      allow_any_instance_of(DewiAdapter).to receive(:judge).and_return(success_result)
      allow_any_instance_of(OpenAiAdapter).to receive(:judge).and_return(success_result)

      params = { failed_personas: %w[dewi nakao] }
      post "/api/posts/#{post_record.id}/rejudge", params: params.to_json, headers: headers

      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json['id']).to eq(post_record.id)
      expect(json['status']).to eq('scored')
    end
  end

  describe '異常系 (Error Path)' do
    # 何を検証するか: 不存在投稿に対してNOT_FOUNDを返すこと
    it '存在しない投稿IDで404 NOT_FOUNDを返す' do
      params = { failed_personas: ['dewi'] }
      post "/api/posts/#{SecureRandom.uuid}/rejudge", params: params.to_json, headers: headers

      expect(response).to have_http_status(:not_found)
      json = response.parsed_body
      expect(json['code']).to eq('NOT_FOUND')
    end

    # 何を検証するか: failed以外の投稿は再審査できずINVALID_STATUSを返すこと
    it 'statusがscoredの投稿に再審査すると422 INVALID_STATUSを返す' do
      post_record = create(:post, :scored)
      params = { failed_personas: ['dewi'] }

      post "/api/posts/#{post_record.id}/rejudge", params: params.to_json, headers: headers

      expect(response).to have_http_status(:unprocessable_content)
      json = response.parsed_body
      expect(json['code']).to eq('INVALID_STATUS')
    end

    # 何を検証するか: 許可されていない審査員IDをINVALID_PERSONAとして拒否すること
    it '無効なpersonaを指定すると422 INVALID_PERSONAを返す' do
      post_record = create(:post, :failed, judges_count: 1)
      params = { failed_personas: ['invalid'] }

      post "/api/posts/#{post_record.id}/rejudge", params: params.to_json, headers: headers

      expect(response).to have_http_status(:unprocessable_content)
      json = response.parsed_body
      expect(json['code']).to eq('INVALID_PERSONA')
    end

    # 何を検証するか: 不正なJSONをBAD_REQUESTとして扱うこと
    it '不正なJSON形式で400 BAD_REQUESTを返す' do
      post_record = create(:post, :failed, judges_count: 1)

      post "/api/posts/#{post_record.id}/rejudge", params: '{ invalid json }', headers: headers

      expect(response).to have_http_status(:bad_request)
      json = response.parsed_body
      expect(json['code']).to eq('BAD_REQUEST')
    end
  end
end
