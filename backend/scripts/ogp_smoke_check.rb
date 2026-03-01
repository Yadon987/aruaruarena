# frozen_string_literal: true

require 'action_dispatch/testing/integration'
require 'json'
require 'securerandom'

# scored投稿を作成し、事前生成サービスがS3へPNGを保存できることを確認する。
post = nil

begin
  post = Post.new(
    id: SecureRandom.uuid,
    nickname: 'OGP確認',
    body: 'Docker内でOGP生成確認',
    status: Post::STATUS_SCORED,
    average_score: 88.8,
    judges_count: 3,
    created_at: Time.now.to_i.to_s
  )
  post.score_key = post.generate_score_key
  post.save!

  s3_client = Aws::S3::Client.new(
    region: 'ap-northeast-1',
    stub_responses: true
  )
  ENV['OGP_S3_BUCKET'] = 'ogp-smoke-test-bucket'

  uploaded = UploadOgpImageService.call(post.id, s3_client:)
  put_request = s3_client.api_requests.find { |request| request[:operation_name] == :put_object }

  result = {
    post_id: post.id,
    uploaded: uploaded,
    bucket: put_request&.dig(:params, :bucket),
    key: put_request&.dig(:params, :key),
    content_type: put_request&.dig(:params, :content_type),
    cache_control: put_request&.dig(:params, :cache_control),
    body_size: put_request&.dig(:params, :body)&.bytesize
  }

  puts JSON.pretty_generate(result)

  unless uploaded &&
         put_request&.dig(:params, :bucket) == 'ogp-smoke-test-bucket' &&
         put_request&.dig(:params, :key) == "ogp/posts/#{post.id}.png" &&
         put_request&.dig(:params, :content_type) == 'image/png'
    warn '[OGP Smoke Check] OGP画像の事前生成アップロードに失敗しました'
    exit 1
  end
ensure
  post&.destroy
end
