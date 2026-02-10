# frozen_string_literal: true

require 'rails_helper'

RSpec.describe JudgePostService do
  describe '.call' do
    let(:post) { create(:post) }

    context '正常系' do
      it 'クラスメソッドでインスタンスを生成しexecuteを呼ぶこと' do
        service = instance_double(JudgePostService, execute: nil)
        allow(JudgePostService).to receive(:new).with(post.id).and_return(service)

        JudgePostService.call(post.id)

        expect(service).to have_received(:execute)
      end

      it 'post_idからPostを取得すること' do
        expect(Post).to receive(:find).with(post.id).and_return(post)
        service = JudgePostService.new(post.id)
        # initialize内でPost.findが呼ばれることを確認
      end

      it 'executeでWARNレベルのログを出力すること（スタブ）' do
        service = JudgePostService.new(post.id)
        expect(Rails.logger).to receive(:warn).with('[JudgePostService] Not implemented yet (E06-05)')

        service.execute
      end
    end

    context '異常系' do
      it '存在しないpost_idで初期化するとエラーになること' do
        expect {
          JudgePostService.new('non-existent-id')
        }.to raise_error(Dynamoid::Errors::RecordNotFound)
      end
    end
  end
end
