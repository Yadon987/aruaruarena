# frozen_string_literal: true

require 'rails_helper'

RSpec.describe LocalJudgmentWorkerService, dynamodb: false do
  describe '#run_once' do
    let(:logger) { instance_double(Logger, info: nil, error: nil) }
    let(:scope) { double('Dynamoid::Criteria::Chain') }
    let(:older_post) { instance_double(Post, id: 'post-1', created_at: Time.zone.at(10)) }
    let(:newer_post) { instance_double(Post, id: 'post-2', created_at: Time.zone.at(20)) }
    let(:service) { described_class.new(logger: logger, poll_interval: 0, batch_size: 10) }

    before do
      allow(Post).to receive(:where).with(status: Post::STATUS_JUDGING).and_return(scope)
      allow(scope).to receive(:record_limit).with(10).and_return(scope)
      allow(scope).to receive(:to_a).and_return([newer_post, older_post])
      allow(JudgePostService).to receive(:call)
    end

    it 'judging 投稿を作成順に審査すること' do
      expect(service.run_once).to eq(2)
      expect(JudgePostService).to have_received(:call).with('post-1').ordered
      expect(JudgePostService).to have_received(:call).with('post-2').ordered
    end

    it '対象がない場合は 0 を返すこと' do
      allow(scope).to receive(:to_a).and_return([])

      expect(service.run_once).to eq(0)
    end
  end
end
