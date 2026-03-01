# frozen_string_literal: true

require 'action_dispatch/testing/integration'
require 'digest'
require 'json'
require 'securerandom'

# scored投稿を作成し、OGPエンドポイントから動的画像が返ることを確認する。
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

  session = ActionDispatch::Integration::Session.new(Rails.application)
  session.get("/ogp/posts/#{post.id}.png")

  default_path = Rails.root.join('app/assets/images/default_ogp.png')
  default_digest = Digest::SHA256.file(default_path).hexdigest
  response_digest = Digest::SHA256.hexdigest(session.response.body)
  generated_image = response_digest != default_digest

  result = {
    post_id: post.id,
    status: session.response.status,
    content_type: session.response.media_type,
    cache_control: session.response.headers['Cache-Control'],
    content_length: session.response.body.bytesize,
    generated_image: generated_image,
    response_sha256: response_digest,
    default_sha256: default_digest
  }

  puts JSON.pretty_generate(result)

  unless session.response.status == 200 &&
         session.response.media_type == 'image/png' &&
         generated_image
    warn '[OGP Smoke Check] OGP画像の動的生成に失敗しました'
    exit 1
  end
ensure
  post&.destroy
end
