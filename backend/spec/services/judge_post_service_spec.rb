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
        JudgePostService.new(post.id)
        # initialize内でPost.findが呼ばれることを確認
      end

      it 'executeでNotImplementedErrorが発生すること（スタブ）' do
        service = JudgePostService.new(post.id)
        expect do
          service.execute
        end.to raise_error(NotImplementedError, 'JudgePostService#execute is not implemented yet (E06-05)')
      end
    end

    context '異常系' do
      it '存在しないpost_idで初期化するとWARNログが出力され、@postがnilになること' do
        expect(Rails.logger).to receive(:warn).with(/\[JudgePostService\] Post not found: non-existent-id/)
        service = JudgePostService.new('non-existent-id')
        expect(service.instance_variable_get(:@post)).to be_nil
      end

      it 'Postがnilの場合はexecuteしても何もしないこと' do
        service = JudgePostService.new('non-existent-id')
        expect { service.execute }.not_to raise_error
      end
    end
  end
end
