RSpec.shared_examples 'openai style parse response' do
  # AdapterTestHelpersのbuild_faraday_responseを使用

  context '正常系' do
    let(:base_scores) do
      { empathy: 15, humor: 10, brevity: 20, originality: 5, expression: 12 }
    end

    it 'スコアとコメントが正しく解析されること' do
      response_body = {
        choices: [{
          message: {
            content: JSON.generate(base_scores.merge(comment: '良い投稿です'))
          }
        }]
      }
      resp = build_faraday_response(response_body)

      result = adapter.send(:parse_response, resp)

      expect(result[:scores][:empathy]).to eq(15)
      expect(result[:scores][:humor]).to eq(10)
      expect(result[:scores][:brevity]).to eq(20)
      expect(result[:scores][:originality]).to eq(5)
      expect(result[:scores][:expression]).to eq(12)
      expect(result[:comment]).to eq('良い投稿です')
    end

    it '文字列のスコアが整数に変換されること' do
      json_content = JSON.generate(
        empathy: "15", humor: "10", brevity: "20",
        originality: "5", expression: "12", comment: 'test'
      )
      response_body = { choices: [{ message: { content: json_content } }] }
      resp = build_faraday_response(response_body)

      result = adapter.send(:parse_response, resp)
      expect(result[:scores][:empathy]).to eq(15)
      expect(result[:scores][:empathy]).to be_a(Integer)
    end

    it '浮動小数点のスコアが整数に変換されること' do
      json_content = JSON.generate(
        empathy: 15.0, humor: 10.0, brevity: 20.0,
        originality: 5.0, expression: 12.0, comment: 'test'
      )
      response_body = { choices: [{ message: { content: json_content } }] }
      resp = build_faraday_response(response_body)

      result = adapter.send(:parse_response, resp)
      expect(result[:scores][:empathy]).to eq(15)
      expect(result[:scores][:empathy]).to be_a(Integer)
    end

    it 'スコアが0の場合も有効とみなされること' do
      json_content = JSON.generate(base_scores.merge(empathy: 0))
      response_body = { choices: [{ message: { content: json_content } }] }
      resp = build_faraday_response(response_body)

      result = adapter.send(:parse_response, resp)
      expect(result[:scores][:empathy]).to eq(0)
    end

    it 'スコアが20の場合も有効とみなされること' do
      json_content = JSON.generate(base_scores.merge(empathy: 20))
      response_body = { choices: [{ message: { content: json_content } }] }
      resp = build_faraday_response(response_body)

      result = adapter.send(:parse_response, resp)
      expect(result[:scores][:empathy]).to eq(20)
    end

    it '小数点以下の数値が四捨五入されること' do
      json_content = JSON.generate(base_scores.merge(empathy: 15.6))
      response_body = { choices: [{ message: { content: json_content } }] }
      resp = build_faraday_response(response_body)

      result = adapter.send(:parse_response, resp)
      expect(result[:scores][:empathy]).to eq(16)
    end
  end

  context '異常系' do
    it '不正なJSONの場合はinvalid_responseエラーを返すこと' do
      response_body = { choices: [{ message: { content: '{ invalid json' } }] }
      resp = build_faraday_response(response_body)

      result = adapter.send(:parse_response, resp)
      expect(result.respond_to?(:error_code) ? result.error_code : result[:error]).to eq('invalid_response')
    end

    it 'choicesが空の場合はinvalid_responseエラーを返すこと' do
      response_body = { choices: [] }
      resp = build_faraday_response(response_body)

      result = adapter.send(:parse_response, resp)
      expect(result.respond_to?(:error_code) ? result.error_code : result[:error]).to eq('invalid_response')
    end

    it 'choicesがnilの場合はinvalid_responseエラーを返すこと' do
      response_body = { choices: nil }
      resp = build_faraday_response(response_body)

      result = adapter.send(:parse_response, resp)
      expect(result.respond_to?(:error_code) ? result.error_code : result[:error]).to eq('invalid_response')
    end

    it '必要なスコアが欠けている場合はinvalid_responseエラーを返すこと' do
      # empathyが欠落
      json_content = JSON.generate(humor: 10, brevity: 10, originality: 10, expression: 10, comment: 'test')
      response_body = { choices: [{ message: { content: json_content } }] }
      resp = build_faraday_response(response_body)

      result = adapter.send(:parse_response, resp)
      expect(result.respond_to?(:error_code) ? result.error_code : result[:error]).to eq('invalid_response')
    end

    it 'スコアが範囲外（-1）の場合はそのままの値を返すこと（親クラスでバリデーション）' do
      json_content = JSON.generate(
        empathy: -1, humor: 10, brevity: 10, originality: 10, expression: 10, comment: 'test'
      )
      response_body = { choices: [{ message: { content: json_content } }] }
      resp = build_faraday_response(response_body)

      result = adapter.send(:parse_response, resp)
      
      scores = result.respond_to?(:scores) ? result.scores : result[:scores]
      expect(scores[:empathy]).to eq(-1)
    end

    it 'スコアが範囲外（21）の場合はそのままの値を返すこと（親クラスでバリデーション）' do
      json_content = JSON.generate(
        empathy: 21, humor: 10, brevity: 10, originality: 10, expression: 10, comment: 'test'
      )
      response_body = { choices: [{ message: { content: json_content } }] }
      resp = build_faraday_response(response_body)

      result = adapter.send(:parse_response, resp)
      
      scores = result.respond_to?(:scores) ? result.scores : result[:scores]
      expect(scores[:empathy]).to eq(21)
    end
  end
end
