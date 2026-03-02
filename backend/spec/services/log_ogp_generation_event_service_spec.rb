# frozen_string_literal: true

require 'rails_helper'

RSpec.describe LogOgpGenerationEventService, type: :service do
  describe '.call' do
    let(:post) { create(:post, id: 'post-id', created_at: '1700000000') }

    it '計測用のstructured logをJSONで出力すること' do
      allow(Rails.logger).to receive(:info)

      described_class.call(
        event: 'post_created',
        post:,
        request_path: '/api/posts'
      )

      expect(Rails.logger).to have_received(:info) do |message|
        payload = JSON.parse(message)

        expect(payload).to include(
          'event' => 'post_created',
          'post_id' => 'post-id',
          'post_status' => 'judging',
          'post_created_at' => '1700000000',
          'request_path' => '/api/posts'
        )
        expect(payload['occurred_at']).to be_present
      end
    end
  end
end
