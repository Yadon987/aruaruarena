# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'API::Posts', type: :request do
  describe 'POST /api/posts' do
    before do
      Post.delete_all
      allow(JudgmentQueueService).to receive(:enqueue)
      allow(RateLimiterService).to receive(:limited?).and_return(false)
      allow(RateLimiterService).to receive(:set_limit!)
      allow(DuplicateCheckService).to receive(:duplicate?).and_return(false)
      allow(DuplicateCheckService).to receive(:register!)
    end

    let(:valid_headers) { { 'Content-Type' => 'application/json' } }
    let(:flat_valid_params) do
      {
        nickname: '太郎',
        body: 'スヌーズ押して二度寝'
      }
    end
    let(:valid_params) do
      {
        post: {
          nickname: '太郎',
          body: 'スヌーズ押して二度寝'
        }
      }
    end

    context '正常系 (Happy Path)' do
      # 検証: 有効なパラメータで201 Createdが返ること
      it '有効なパラメータで投稿が作成される（201 Created）' do
        post '/api/posts', params: valid_params.to_json, headers: valid_headers
        expect(response).to have_http_status(:created)

        json = response.parsed_body
        expect(json['id']).to be_present
        expect(json['status']).to eq('judging')
      end

      it 'フラット形式のパラメータで投稿が作成される（201 Created）' do
        post '/api/posts', params: flat_valid_params.to_json, headers: valid_headers
        expect(response).to have_http_status(:created)

        json = response.parsed_body
        expect(json['id']).to be_present
        expect(json['status']).to eq('judging')
      end

      # 検証: 日本語入力の確認
      it '日本語のニックネーム・本文で投稿成功' do
        expect do
          post '/api/posts', params: valid_params.to_json, headers: valid_headers
        end.to change(Post, :count).by(1)
        expect(response).to have_http_status(:created)
      end

      it '投稿作成時に計測用structured logを出力すること' do
        info_messages = []
        allow(Rails.logger).to receive(:info) do |message|
          info_messages << message if message.present?
        end

        post '/api/posts', params: valid_params.to_json, headers: valid_headers

        structured_log = info_messages.find { |message| message.include?('"event":"post_created"') }
        payload = JSON.parse(structured_log)

        expect(payload).to include(
          'event' => 'post_created',
          'post_status' => 'judging'
        )
        expect(payload['post_id']).to be_present
        expect(payload['post_created_at']).to be_present
      end

      # 検証: 境界値下限（nickname:1, body:3）
      it 'ニックネーム1文字・本文3文字（境界値下限）で投稿成功' do
        params = { post: { nickname: 'a', body: 'abc' } }
        post '/api/posts', params: params.to_json, headers: valid_headers
        expect(response).to have_http_status(:created)
      end

      # 検証: 境界値上限（nickname:20, body:30）
      it 'ニックネーム20文字・本文30文字（境界値上限）で投稿成功' do
        params = { post: { nickname: 'a' * 20, body: 'a' * 30 } }
        post '/api/posts', params: params.to_json, headers: valid_headers
        expect(response).to have_http_status(:created)
      end

      # 検証: 絵文字（grapheme単位カウント）
      it '絵文字を含む本文（3 grapheme）で投稿成功' do
        params = { post: { nickname: '太郎', body: '😀😀😀' } } # 3文字
        post '/api/posts', params: params.to_json, headers: valid_headers
        expect(response).to have_http_status(:created)
      end

      # 検証: 結合絵文字
      it '結合絵文字を含む本文で投稿成功' do
        params = { post: { nickname: '太郎', body: '家族👨‍👩‍👧‍👦' } } # 3文字（家、族、👨‍👩‍👧‍👦）
        post '/api/posts', params: params.to_json, headers: valid_headers
        expect(response).to have_http_status(:created)
      end

      # 検証: 前後の半角空白除去
      it '前後の半角空白がstripされて保存される' do
        params = { post: { nickname: ' 太郎 ', body: ' テスト投稿 ' } }
        post '/api/posts', params: params.to_json, headers: valid_headers

        json = response.parsed_body
        created_post = Post.find(json['id'])
        expect(created_post.nickname).to eq('太郎')
        expect(created_post.body).to eq('テスト投稿')
      end

      # 検証: 前後の全角空白除去
      it '前後の全角空白がstripされて保存される' do
        params = { post: { nickname: '　太郎　', body: '　テスト投稿　' } }
        post '/api/posts', params: params.to_json, headers: valid_headers

        json = response.parsed_body
        created_post = Post.find(json['id'])
        expect(created_post.nickname).to eq('太郎')
        expect(created_post.body).to eq('テスト投稿')
      end
    end

    context '異常系 (Error Path)' do
      # 検証: ニックネーム必須
      it 'ニックネーム空文字で422 VALIDATION_ERROR' do
        params = { post: { nickname: '', body: '本文テスト' } }
        post '/api/posts', params: params.to_json, headers: valid_headers

        expect(response).to have_http_status(:unprocessable_content)
        json = response.parsed_body
        expect(json['error']).to include('ニックネームを入力してください')
        expect(json['code']).to eq('VALIDATION_ERROR')
      end

      # 検証: ニックネーム文字数超過
      it 'ニックネーム21文字で422 VALIDATION_ERROR' do
        params = { post: { nickname: 'a' * 21, body: '本文テスト' } }
        post '/api/posts', params: params.to_json, headers: valid_headers
        expect(response).to have_http_status(:unprocessable_content)
      end

      # 検証: 本文必須
      it '本文空文字で422 VALIDATION_ERROR' do
        params = { post: { nickname: '太郎', body: '' } }
        post '/api/posts', params: params.to_json, headers: valid_headers

        expect(response).to have_http_status(:unprocessable_content)
        json = response.parsed_body
        expect(json['error']).to include('本文を入力してください')
      end

      # 検証: 本文文字数不足
      it '本文2文字で422 VALIDATION_ERROR' do
        params = { post: { nickname: '太郎', body: 'ab' } }
        post '/api/posts', params: params.to_json, headers: valid_headers
        expect(response).to have_http_status(:unprocessable_content)
      end

      # 検証: 本文文字数超過
      it '本文31文字で422 VALIDATION_ERROR' do
        params = { post: { nickname: '太郎', body: 'a' * 31 } }
        post '/api/posts', params: params.to_json, headers: valid_headers
        expect(response).to have_http_status(:unprocessable_content)
      end

      # 検証: Strong Parameters (status無視)
      it 'statusパラメータはStrong Parametersで無視される' do
        params = {
          post: {
            nickname: '太郎',
            body: 'テスト投稿',
            status: 'scored' # ← 無視されるべき
          }
        }
        post '/api/posts', params: params.to_json, headers: valid_headers

        expect(response).to have_http_status(:created)
        json = response.parsed_body
        expect(json['status']).to eq('judging')

        created_post = Post.find(json['id'])
        expect(created_post.status).to eq('judging')
      end

      # 検証: 不正なJSON
      it '不正なJSON形式で400 BAD_REQUEST' do
        post '/api/posts', params: '{ invalid json }', headers: valid_headers

        expect(response).to have_http_status(:bad_request)
        json = response.parsed_body
        expect(json['error']).to include('リクエスト形式が正しくありません')
        expect(json['code']).to eq('BAD_REQUEST')
      end

      # 検証: 空ボディ
      it 'リクエストボディが空で422 VALIDATION_ERROR' do
        post '/api/posts', params: '', headers: valid_headers
        expect(response).to have_http_status(:unprocessable_content)
        json = response.parsed_body
        expect(json['code']).to eq('VALIDATION_ERROR')
      end

      it 'postキーがなくnickname/body以外のみのリクエストで422 VALIDATION_ERROR' do
        post '/api/posts', params: { invalid: { nickname: '太郎', body: '本文' } }.to_json, headers: valid_headers

        expect(response).to have_http_status(:unprocessable_content)
        json = response.parsed_body
        expect(json['code']).to eq('VALIDATION_ERROR')
      end

      it 'フラット形式でnicknameキーが不足した場合は422 VALIDATION_ERROR' do
        post '/api/posts', params: { body: '本文' }.to_json, headers: valid_headers

        expect(response).to have_http_status(:unprocessable_content)
        json = response.parsed_body
        expect(json['code']).to eq('VALIDATION_ERROR')
      end

      # 検証: Content-Type検証
      it 'Content-Type: text/htmlで415 Unsupported Media Type' do
        post '/api/posts', params: valid_params.to_json, headers: { 'Content-Type' => 'text/html' }
        expect(response).to have_http_status(:unsupported_media_type)
        json = response.parsed_body
        expect(json['code']).to eq('UNSUPPORTED_MEDIA_TYPE')
      end

      it 'Content-Type に charset が付いていても application/json なら受け付ける' do
        post '/api/posts', params: valid_params.to_json,
                           headers: { 'Content-Type' => 'application/json; charset=utf-8' }

        expect(response).to have_http_status(:created)
      end
    end

    context '境界値 (Edge Case)' do
      # 検証: 結合絵文字カウント
      it '結合絵文字が1 graphemeとしてカウントされる' do
        # 👨‍👩‍👧‍👦 (1 grapheme) + a (1) + b (1) = 3文字
        params = { post: { nickname: '太郎', body: '👨‍👩‍👧‍👦ab' } }
        post '/api/posts', params: params.to_json, headers: valid_headers
        expect(response).to have_http_status(:created)
      end

      # 検証: 絵文字修飾子
      it '絵文字修飾子が1 graphemeとしてカウントされる' do
        # 👨🏻‍💻 (1 grapheme) + ab (2) = 3文字
        params = { post: { nickname: '太郎', body: '👨🏻‍💻ab' } }
        post '/api/posts', params: params.to_json, headers: valid_headers
        expect(response).to have_http_status(:created)
      end

      # 検証: 半角空白のみnickname
      it '半角空白のみのnicknameでバリデーションエラー' do
        params = { post: { nickname: '   ', body: '本文テスト' } }
        post '/api/posts', params: params.to_json, headers: valid_headers
        expect(response).to have_http_status(:unprocessable_content)
      end

      # 検証: 全角空白のみnickname
      it '全角空白のみのnicknameでバリデーションエラー' do
        params = { post: { nickname: '　　', body: '本文テスト' } }
        post '/api/posts', params: params.to_json, headers: valid_headers
        expect(response).to have_http_status(:unprocessable_content)
      end

      # 検証: 半角空白のみbody
      it '半角空白のみのbodyでバリデーションエラー' do
        params = { post: { nickname: '太郎', body: '   ' } }
        post '/api/posts', params: params.to_json, headers: valid_headers
        expect(response).to have_http_status(:unprocessable_content)
      end

      # 検証: 全角空白のみbody
      it '全角空白のみのbodyでバリデーションエラー' do
        params = { post: { nickname: '太郎', body: '　　' } }
        post '/api/posts', params: params.to_json, headers: valid_headers
        expect(response).to have_http_status(:unprocessable_content)
      end

      # 検証: マルチバイト混在
      it 'マルチバイト文字混在の本文で正常に保存される' do
        # 日(1)+絵(1)+英(1) = 3文字
        params = { post: { nickname: '太郎', body: 'あ😀a' } }
        post '/api/posts', params: params.to_json, headers: valid_headers
        expect(response).to have_http_status(:created)
      end

      # 検証: エラー優先順位
      it '複数エラー時はnicknameのエラーが優先される' do
        # nickname空, body空
        params = { post: { nickname: '', body: '' } }
        post '/api/posts', params: params.to_json, headers: valid_headers

        expect(response).to have_http_status(:unprocessable_content)
        json = response.parsed_body
        expect(json['error']).to include('ニックネームを入力してください')
      end
    end

    context 'レート制限 (E09-01)' do
      # rails_helper.rbで各テスト前にPost.delete_all, RateLimit.delete_allが実行されるため
      # ここでのdelete_allは不要
      before do
        allow(RateLimiterService).to receive(:limited?).and_call_original
        allow(RateLimiterService).to receive(:set_limit!).and_call_original
      end

      let(:valid_headers) do
        { 'Content-Type' => 'application/json', 'REMOTE_ADDR' => '192.168.1.1' }
      end
      let(:valid_params) do
        {
          post: {
            nickname: '太郎',
            body: 'スヌーズ押して二度寝'
          }
        }
      end
      let(:same_ip_params) do
        {
          post: {
            nickname: '次郎',
            body: '同じIPの投稿です'
          }
        }
      end
      let(:same_nickname_params) do
        {
          post: {
            nickname: '太郎',
            body: '同じニックネームの投稿'
          }
        }
      end

      # Given: 初回投稿（IP・ニックネームともに制限なし）
      # When: 投稿リクエスト
      # Then: 投稿成功（201 Created）
      it '初回投稿は正常に投稿できる（201 Created）' do
        post '/api/posts', params: valid_params.to_json, headers: valid_headers
        expect(response).to have_http_status(:created)
        json = response.parsed_body
        expect(json['id']).to be_present
        expect(json['status']).to eq('judging')
      end

      # Given: 同一IPで初回投稿成功
      # When: 5分以内に2回目の投稿
      # Then: 429 Too Many Requests + error message
      it '同一IPで5分以内に2回目の投稿は429エラーを返す' do
        # 初回投稿
        post '/api/posts', params: valid_params.to_json, headers: valid_headers
        expect(response).to have_http_status(:created)

        # 2回目（同一IP）
        post '/api/posts', params: same_ip_params.to_json, headers: valid_headers
        expect(response).to have_http_status(:too_many_requests)

        json = response.parsed_body
        expect(json['error']).to eq('投稿頻度を制限中')
        expect(json['code']).to eq('RATE_LIMITED')
      end

      # Given: 同一ニックネームで初回投稿成功（異なるIP）
      # When: 5分以内に2回目の投稿
      # Then: 429 Too Many Requests
      it '同一ニックネームで5分以内に2回目の投稿は429エラーを返す' do
        # 初回投稿（IP: 192.168.1.1）
        post '/api/posts', params: valid_params.to_json, headers: valid_headers
        expect(response).to have_http_status(:created)

        # 2回目（同一ニックネーム、異なるIP）
        different_ip_headers = valid_headers.merge('REMOTE_ADDR' => '192.168.1.2')
        post '/api/posts', params: same_nickname_params.to_json, headers: different_ip_headers
        expect(response).to have_http_status(:too_many_requests)

        json = response.parsed_body
        expect(json['error']).to eq('投稿頻度を制限中')
        expect(json['code']).to eq('RATE_LIMITED')
      end

      # Given: 異なるIPかつ異なるニックネーム
      # When: 連続投稿リクエスト
      # Then: 両方とも投稿成功（201 Created）
      it '異なるIPかつ異なるニックネームの場合は連続投稿可能' do
        # 初回投稿
        post '/api/posts', params: valid_params.to_json, headers: valid_headers
        expect(response).to have_http_status(:created)

        # 異なるIP・異なるニックネーム
        different_params = {
          post: {
            nickname: '次郎',
            body: '異なるIPの投稿です'
          }
        }
        different_headers = valid_headers.merge('REMOTE_ADDR' => '192.168.1.2')
        post '/api/posts', params: different_params.to_json, headers: different_headers
        expect(response).to have_http_status(:created)
      end

      # Given: 初回投稿成功
      # When: 5分以内に2回目の投稿（同じIP・ニックネーム）
      # Then: 429 Too Many Requests + 正しいエラーレスポンス
      it 'レート制限エラーの場合、レスポンスボディが正しいこと' do
        # 初回投稿
        post '/api/posts', params: valid_params.to_json, headers: valid_headers
        expect(response).to have_http_status(:created)

        # 2回目
        post '/api/posts', params: valid_params.to_json, headers: valid_headers
        expect(response).to have_http_status(:too_many_requests)

        json = response.parsed_body
        expect(json['error']).to eq('投稿頻度を制限中')
        expect(json['code']).to eq('RATE_LIMITED')
      end

      # Given: 同一IPで5分以内に2回目の投稿（ニックネームが空）
      # When: 投稿リクエスト
      # Then: レート制限が先に返される（429）
      it 'バリデーションエラーとレート制限が同時に発生する場合、レート制限が先に返される' do
        # 初回投稿
        post '/api/posts', params: valid_params.to_json, headers: valid_headers
        expect(response).to have_http_status(:created)

        # 2回目（ニックネーム空 - バリデーションエラーだがレート制限が先）
        invalid_params = {
          post: {
            nickname: '',
            body: '本文テスト'
          }
        }
        post '/api/posts', params: invalid_params.to_json, headers: valid_headers

        # レート制限（429）がバリデーションエラー（422）より優先
        expect(response).to have_http_status(:too_many_requests)

        json = response.parsed_body
        expect(json['error']).to eq('投稿頻度を制限中')
        expect(json['code']).to eq('RATE_LIMITED')
      end

      # Given: DynamoDB接続エラー（RateLimiterService内部でrescue）
      # When: 投稿リクエスト
      # Then: 投稿成功（フェイルオープン）
      # 注意: limited?メソッド内部でrescueするため、コントローラーではなくサービス内部をモックする必要がある。
      #       RateLimiterService.limited? 自体にand_raiseすると、サービス内のrescueをテストできない。
      #       ここではRateLimit.findをモックして、サービス内のrescue動作を統合テストする。
      it 'レート制限チェック時のDynamoDBエラーは投稿を阻害しない' do
        # DynamoDBエラーをモック（サービス内部のfind呼び出しに対して）
        allow(RateLimit).to receive(:find).and_raise(Aws::DynamoDB::Errors::ServiceError.new(nil,
                                                                                             'Service unavailable'))
        allow(Rails.logger).to receive(:error)

        # 投稿リクエスト
        post '/api/posts', params: valid_params.to_json, headers: valid_headers

        # 投稿成功（フェイルオープン）
        expect(response).to have_http_status(:created)
        json = response.parsed_body
        expect(json['id']).to be_present
      end

      # Given: 投稿保存後のレート制限設定で例外発生
      # When: 投稿リクエスト
      # Then: 例外を握りつぶして投稿成功（201 Created）
      it 'レート制限設定時の例外は投稿を阻害しない' do
        # 何を検証するか: RateLimiterService.set_limit! が失敗(false)でも投稿作成レスポンスが成功すること
        allow(RateLimiterService).to receive(:set_limit!).and_return(false)
        allow(Rails.logger).to receive(:error)

        post '/api/posts', params: valid_params.to_json, headers: valid_headers

        expect(response).to have_http_status(:created)
        json = response.parsed_body
        expect(json['id']).to be_present
        expect(Rails.logger).to have_received(:error).with('[PostsController#create] Rate limit set failed')
      end
    end

    context '非同期審査トリガー (E05-06)' do
      it '投稿成功時に審査キューへ投入されること' do
        expect(JudgmentQueueService).to receive(:enqueue).once.with(instance_of(String))

        post '/api/posts', params: valid_params.to_json, headers: valid_headers

        expect(response).to have_http_status(:created)
      end

      it 'キュー投入で例外が発生した場合は投稿をfailedに更新すること' do
        allow(JudgmentQueueService).to receive(:enqueue).and_raise(StandardError, 'queue error')

        post '/api/posts', params: valid_params.to_json, headers: valid_headers

        expect(response).to have_http_status(:created)
        created_post = Post.find(response.parsed_body['id'])
        expect(created_post.status).to eq(Post::STATUS_FAILED)
      end

      it 'Postが削除されている場合は審査をスキップすること' do
        allow(JudgmentQueueService).to receive(:enqueue)

        post '/api/posts', params: valid_params.to_json, headers: valid_headers
        post_id = response.parsed_body['id']
        Post.find(post_id).destroy

        # JudgePostServiceが呼ばれてもRecordNotFoundでWARNログが出力されること
        expect(Rails.logger).to receive(:warn).with(/\[JudgePostService\] Post not found: #{post_id}/)

        expect(JudgePostService.call(post_id)).to be_nil
      end
    end

    context '重複チェック (E09-02)' do
      before do
        allow(DuplicateCheckService).to receive(:duplicate?).and_call_original
        allow(DuplicateCheckService).to receive(:register!).and_call_original
      end

      let(:valid_headers) do
        { 'Content-Type' => 'application/json', 'REMOTE_ADDR' => '192.168.1.1' }
      end
      let(:valid_params) do
        {
          post: {
            nickname: '太郎',
            body: 'スヌーズ押して二度寝'
          }
        }
      end
      let(:duplicate_params) do
        {
          post: {
            nickname: '次郎',
            body: 'スヌーズ押して二度寝'
          }
        }
      end
      let(:different_ip_params) do
        {
          post: {
            nickname: '三郎',
            body: 'スヌーズ押して二度寝'
          }
        }
      end
      let(:different_ip_headers) do
        valid_headers.merge('REMOTE_ADDR' => '192.168.1.2')
      end

      # 初回投稿は正常に投稿できる（201 Created）
      it '初回投稿は正常に投稿できる（201 Created）' do
        post '/api/posts', params: valid_params.to_json, headers: valid_headers
        expect(response).to have_http_status(:created)
        json = response.parsed_body
        expect(json['id']).to be_present
        expect(json['status']).to eq('judging')
      end

      # 同一内容の投稿は422エラーを返す
      it '同一内容の投稿は422エラーを返す' do
        # 初回投稿
        post '/api/posts', params: valid_params.to_json, headers: valid_headers
        expect(response).to have_http_status(:created)

        # レート制限をバイパス（重複チェックのテストのため）
        allow(RateLimiterService).to receive(:limited?).and_return(false)

        # 2回目（同一内容）
        post '/api/posts', params: duplicate_params.to_json, headers: valid_headers
        expect(response).to have_http_status(:unprocessable_content)
        json = response.parsed_body
        expect(json['error']).to eq('同じ内容の投稿があります')
        expect(json['code']).to eq('DUPLICATE_CONTENT')
      end

      # 異なるIP・異なるニックネームの場合は投稿可能
      it '異なるIP・異なるニックネームの場合は投稿可能' do
        post '/api/posts', params: different_ip_params.to_json, headers: different_ip_headers
        expect(response).to have_http_status(:created)
      end

      # 重複エラーの場合、レスポンスボディが正しいこと
      it '重複エラーの場合、レスポンスボディが正しいこと' do
        # 初回投稿
        post '/api/posts', params: valid_params.to_json, headers: valid_headers
        expect(response).to have_http_status(:created)

        # レート制限をバイパス（重複チェックのテストのため）
        allow(RateLimiterService).to receive(:limited?).and_return(false)

        # 2回目（同一内容）
        post '/api/posts', params: duplicate_params.to_json, headers: valid_headers
        expect(response).to have_http_status(:unprocessable_content)

        json = response.parsed_body
        expect(json['error']).to eq('同じ内容の投稿があります')
        expect(json['code']).to eq('DUPLICATE_CONTENT')
      end

      # 24時間経過後は投稿可能
      it '24時間経過後は投稿可能' do
        # 初回投稿（expires_at = 現在時刻、期限切れ）
        body_hash = DuplicateCheck.generate_body_hash('スヌーズ押して二度寝')
        create(:duplicate_check, body_hash: body_hash, post_id: 'test_id', expires_at: Time.now.to_i)

        post '/api/posts', params: valid_params.to_json, headers: valid_headers
        expect(response).to have_http_status(:created)
      end

      # DynamoDB接続エラー時は投稿を阻害しない
      it 'DynamoDB接続エラー時は投稿を阻害しない' do
        allow(DuplicateCheck).to receive(:find).and_raise(
          Aws::DynamoDB::Errors::ServiceError.new(nil, 'Service unavailable')
        )
        allow(Rails.logger).to receive(:error)

        post '/api/posts', params: valid_params.to_json, headers: valid_headers
        expect(response).to have_http_status(:created)
        json = response.parsed_body
        expect(json['id']).to be_present
      end

      # 重複チェック時のDynamoDBエラーは投稿を阻害しない
      it 'register!時のDynamoDBエラーは投稿を阻害しない' do
        allow(DuplicateCheckService).to receive(:register!).and_raise(
          Aws::DynamoDB::Errors::ServiceError.new(nil, 'Service unavailable')
        )
        allow(Rails.logger).to receive(:error)

        post '/api/posts', params: valid_params.to_json, headers: valid_headers
        expect(response).to have_http_status(:created)
        json = response.parsed_body
        expect(json['id']).to be_present
      end
    end

    context 'E21 RED: Secrets Manager統合' do
      # 何を検証するか: シークレット取得成功時は投稿作成フローがSecrets Manager連携込みで成立すること
      it 'シークレット取得成功時に投稿が正常に作成されること' do
        secrets_manager_client = class_double('SecretsManagerClient').as_stubbed_const
        allow(secrets_manager_client).to receive(:get_api_key).and_return('test-api-key-from-secrets')

        post '/api/posts', params: valid_params.to_json, headers: valid_headers

        expect(response).to have_http_status(:created)
        expect(secrets_manager_client).to have_received(:get_api_key).at_least(:once)
      end

      # 何を検証するか: シークレット取得失敗時は500と専用エラーコードを返すこと
      it 'シークレット取得失敗時に500エラーとsecrets_fetch_failedを返すこと' do
        allow(JudgmentQueueService).to receive(:enqueue).and_raise(ArgumentError, 'secrets_fetch_failed')

        post '/api/posts', params: valid_params.to_json, headers: valid_headers

        expect(response).to have_http_status(:internal_server_error)
        expect(response.parsed_body).to include(
          'error' => include('シークレット取得に失敗しました'),
          'code' => 'secrets_fetch_failed'
        )
      end
    end
  end
end
