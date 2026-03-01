# frozen_string_literal: true

require 'rails_helper'
require Rails.root.join('app.rb')

RSpec.describe 'SQS Handler', dynamodb: false do
  describe '#handle_sqs_event' do
    it 'SQS イベントの post_id を順に審査サービスへ渡すこと' do
      event = {
        'Records' => [
          { 'eventSource' => 'aws:sqs', 'body' => { post_id: 'post-1' }.to_json },
          { 'eventSource' => 'aws:sqs', 'body' => { post_id: 'post-2' }.to_json }
        ]
      }

      allow(JudgePostService).to receive(:call)

      result = handle_sqs_event(event)

      expect(JudgePostService).to have_received(:call).with('post-1').once
      expect(JudgePostService).to have_received(:call).with('post-2').once
      expect(result).to eq(batchItemFailures: [])
    end
  end
end
