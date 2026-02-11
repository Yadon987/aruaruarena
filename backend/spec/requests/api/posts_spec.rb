# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'API::Posts', type: :request do
  describe 'POST /api/posts' do
    before { Post.delete_all }

    let(:valid_headers) { { 'Content-Type' => 'application/json' } }
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

      # 検証: 日本語入力の確認
      it '日本語のニックネーム・本文で投稿成功' do
        expect do
          post '/api/posts', params: valid_params.to_json, headers: valid_headers
        end.to change(Post, :count).by(1)
        expect(response).to have_http_status(:created)
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

        expect(response).to have_http_status(:unprocessable_entity)
        json = response.parsed_body
        expect(json['error']).to include('ニックネームを入力してください')
        expect(json['code']).to eq('VALIDATION_ERROR')
      end

      # 検証: ニックネーム文字数超過
      it 'ニックネーム21文字で422 VALIDATION_ERROR' do
        params = { post: { nickname: 'a' * 21, body: '本文テスト' } }
        post '/api/posts', params: params.to_json, headers: valid_headers
        expect(response).to have_http_status(:unprocessable_entity)
      end

      # 検証: 本文必須
      it '本文空文字で422 VALIDATION_ERROR' do
        params = { post: { nickname: '太郎', body: '' } }
        post '/api/posts', params: params.to_json, headers: valid_headers

        expect(response).to have_http_status(:unprocessable_entity)
        json = response.parsed_body
        expect(json['error']).to include('本文を入力してください')
      end

      # 検証: 本文文字数不足
      it '本文2文字で422 VALIDATION_ERROR' do
        params = { post: { nickname: '太郎', body: 'ab' } }
        post '/api/posts', params: params.to_json, headers: valid_headers
        expect(response).to have_http_status(:unprocessable_entity)
      end

      # 検証: 本文文字数超過
      it '本文31文字で422 VALIDATION_ERROR' do
        params = { post: { nickname: '太郎', body: 'a' * 31 } }
        post '/api/posts', params: params.to_json, headers: valid_headers
        expect(response).to have_http_status(:unprocessable_entity)
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
      it 'リクエストボディが空で400 BAD_REQUEST' do
        post '/api/posts', params: '', headers: valid_headers
        expect(response).to have_http_status(:bad_request)
      end

      # 検証: Content-Type検証
      it 'Content-Type: text/htmlで415 Unsupported Media Type' do
        skip 'Content-Type検証は次のフェーズで実装'
        post '/api/posts', params: valid_params.to_json, headers: { 'Content-Type' => 'text/html' }
        expect(response).to have_http_status(:unsupported_media_type)
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
        expect(response).to have_http_status(:unprocessable_entity)
      end

      # 検証: 全角空白のみnickname
      it '全角空白のみのnicknameでバリデーションエラー' do
        params = { post: { nickname: '　　', body: '本文テスト' } }
        post '/api/posts', params: params.to_json, headers: valid_headers
        expect(response).to have_http_status(:unprocessable_entity)
      end

      # 検証: 半角空白のみbody
      it '半角空白のみのbodyでバリデーションエラー' do
        params = { post: { nickname: '太郎', body: '   ' } }
        post '/api/posts', params: params.to_json, headers: valid_headers
        expect(response).to have_http_status(:unprocessable_entity)
      end

      # 検証: 全角空白のみbody
      it '全角空白のみのbodyでバリデーションエラー' do
        params = { post: { nickname: '太郎', body: '　　' } }
        post '/api/posts', params: params.to_json, headers: valid_headers
        expect(response).to have_http_status(:unprocessable_entity)
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

        expect(response).to have_http_status(:unprocessable_entity)
        json = response.parsed_body
        expect(json['error']).to include('ニックネームを入力してください')
      end
    end

    context '非同期審査トリガー (E05-06)' do
      # 検証: JudgePostServiceが非同期で呼び出される
      it '投稿成功時にJudgePostServiceが非同期で呼び出されること' do
        # JudgePostService.callが呼ばれることをモックで検証
        call_count = 0
        allow(JudgePostService).to receive(:call) do |*_args|
          call_count += 1
        end

        # リクエストをThread内で実行して完了を待機
        thread = Thread.new do
          post '/api/posts', params: valid_params.to_json, headers: valid_headers
        end
        thread.join # リクエストの完了を待機

        # Thread内のJudgePostServiceは非同期なので、少し待つ
        sleep(0.1)

        # レスポンスは即時に返る
        expect(response).to have_http_status(:created)
        expect(call_count).to eq(1)
      end

      # 検証: Thread内の例外はレスポンスに影響しない
      it 'Thread内で例外が発生してもレスポンスには影響しないこと' do
        # JudgePostService.callで例外を発生させる
        allow(JudgePostService).to receive(:call) do
          raise StandardError, 'Test error in JudgePostService'
        end

        # 例外が発生してもレスポンスは正常に返る
        expect do
          post '/api/posts', params: valid_params.to_json, headers: valid_headers
        end.not_to raise_error

        expect(response).to have_http_status(:created)
      end

      # 検証: Postが削除されている場合の挙動
      it 'Postが削除されている場合は審査をスキップすること' do
        # コントローラーの非同期呼び出しをスタブ化して競合を回避
        allow(JudgePostService).to receive(:call)

        # 投稿を作成
        post '/api/posts', params: valid_params.to_json, headers: valid_headers
        post_id = response.parsed_body['id']

        # 投稿を削除
        Post.find(post_id).destroy

        # スタブを解除
        allow(JudgePostService).to receive(:call).and_call_original

        # JudgePostServiceが呼ばれてもRecordNotFoundでWARNログが出力されること
        expect(Rails.logger).to receive(:warn).with(/\[JudgePostService\] Post not found: #{post_id}/)

        # Thread内でJudgePostServiceを実行
        thread = Thread.new do
          JudgePostService.call(post_id)
        end
        thread.join

        # 例外が発生しないこと
        expect(thread.value).to be_nil
      end
    end
  end
end
