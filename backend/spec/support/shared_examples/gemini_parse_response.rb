# frozen_string_literal: true

RSpec.shared_examples 'gemini parse response' do
  let(:base_scores) do
    {
      empathy: 15,
      humor: 15,
      brevity: 15,
      originality: 15,
      expression: 15
    }
  end

  def gemini_response_with_text(text)
    build_faraday_response(candidates: [{ content: { parts: [{ text: text }] } }])
  end

  def parse_gemini_text(text)
    adapter.send(:parse_response, gemini_response_with_text(text))
  end

  context '共通の正常系' do
    it 'スコアとコメントが正しく解析されること' do
      result = parse_gemini_text(
        JSON.generate(base_scores.merge(comment: 'それって本当？'))
      )

      expect(result).to be_a(Hash)
      expect(result[:scores]).to eq(base_scores)
      expect(result[:comment]).to eq('それって本当？')
    end

    it 'スコアが文字列の場合に整数へ変換されること' do
      result = parse_gemini_text(
        JSON.generate(base_scores.transform_values(&:to_s).merge(comment: 'テスト'))
      )

      expect(result[:scores][:empathy]).to eq(15)
      expect(result[:scores][:empathy]).to be_a(Integer)
    end

    it 'スコアが浮動小数点数の場合に整数へ変換されること' do
      result = parse_gemini_text(
        JSON.generate(base_scores.transform_values(&:to_f).merge(comment: 'テスト'))
      )

      expect(result[:scores][:empathy]).to eq(15)
      expect(result[:scores][:empathy]).to be_a(Integer)
    end

    it '小数点文字列のスコアを四捨五入して整数へ変換できること' do
      decimal_string_scores = base_scores.merge(empathy: '12.5', humor: '15.7', brevity: '8.2')
      result = parse_gemini_text(
        JSON.generate(decimal_string_scores.merge(comment: 'テスト'))
      )

      expect(result[:scores][:empathy]).to eq(13)
      expect(result[:scores][:humor]).to eq(16)
      expect(result[:scores][:brevity]).to eq(8)
    end

    it '小数点のスコアを四捨五入して整数へ変換できること' do
      decimal_float_scores = base_scores.merge(empathy: 12.5, humor: 15.7, brevity: 8.2)
      result = parse_gemini_text(
        JSON.generate(decimal_float_scores.merge(comment: 'テスト'))
      )

      expect(result[:scores][:empathy]).to eq(13)
      expect(result[:scores][:humor]).to eq(16)
      expect(result[:scores][:brevity]).to eq(8)
    end

    it '境界値 0.5 を正しく丸められること' do
      result = parse_gemini_text(
        JSON.generate(base_scores.transform_values { 0.5 }.merge(comment: '境界値テスト'))
      )

      expect(result[:scores][:empathy]).to eq(1)
    end

    it 'スコアが0でも有効と判定されること' do
      result = parse_gemini_text(
        JSON.generate(base_scores.transform_values { 0 }.merge(comment: '最低点'))
      )

      expect(result[:scores][:empathy]).to eq(0)
    end

    it 'スコアが20でも有効と判定されること' do
      result = parse_gemini_text(
        JSON.generate(base_scores.transform_values { 20 }.merge(comment: '満点'))
      )

      expect(result[:scores][:empathy]).to eq(20)
    end
  end

  context '共通の異常系' do
    it '不正なJSONの場合はinvalid_responseエラーコードを返すこと' do
      result = parse_gemini_text('invalid json{')

      expect(result).to be_a(BaseAiAdapter::JudgmentResult)
      expect(result.succeeded).to be false
      expect(result.error_code).to eq('invalid_response')
    end

    it '必要なスコアが欠落している場合はinvalid_responseエラーコードを返すこと' do
      result = parse_gemini_text(
        JSON.generate(base_scores.except(:empathy).merge(comment: 'テスト'))
      )

      expect(result).to be_a(BaseAiAdapter::JudgmentResult)
      expect(result.succeeded).to be false
      expect(result.error_code).to eq('invalid_response')
    end

    it 'candidatesが空の場合はinvalid_responseエラーコードを返すこと' do
      result = adapter.send(:parse_response, build_faraday_response(candidates: []))

      expect(result).to be_a(BaseAiAdapter::JudgmentResult)
      expect(result.succeeded).to be false
      expect(result.error_code).to eq('invalid_response')
    end

    it 'candidatesがnilの場合はinvalid_responseエラーコードを返すこと' do
      result = adapter.send(:parse_response, build_faraday_response(candidates: nil))

      expect(result).to be_a(BaseAiAdapter::JudgmentResult)
      expect(result.succeeded).to be false
      expect(result.error_code).to eq('invalid_response')
    end

    it 'commentが空文字列でもパースできること' do
      result = parse_gemini_text(JSON.generate(base_scores.merge(comment: '')))

      expect(result).to be_a(Hash)
      expect(result[:comment]).to eq('')
    end

    it 'commentが欠落していてもパースできること' do
      result = parse_gemini_text(JSON.generate(base_scores))

      expect(result).to be_a(Hash)
      expect(result[:comment]).to be_nil
    end

    it 'スコアが-1の場合はinvalid_responseエラーコードを返すこと' do
      result = parse_gemini_text(
        JSON.generate(base_scores.merge(empathy: -1, comment: 'テスト'))
      )

      expect(result).to be_a(BaseAiAdapter::JudgmentResult)
      expect(result.error_code).to eq('invalid_response')
    end

    it 'スコアが21の場合はinvalid_responseエラーコードを返すこと' do
      result = parse_gemini_text(
        JSON.generate(base_scores.merge(empathy: 21, comment: 'テスト'))
      )

      expect(result).to be_a(BaseAiAdapter::JudgmentResult)
      expect(result.error_code).to eq('invalid_response')
    end
  end

  context 'コメント長の境界値' do
    it 'commentが30文字を超える場合はtruncateされること' do
      result = parse_gemini_text(JSON.generate(base_scores.merge(comment: 'a' * 35)))

      expect(result).to be_a(Hash)
      expect(result[:comment].length).to eq(30)
    end

    it 'commentがちょうど30文字の場合はtruncateされないこと' do
      result = parse_gemini_text(JSON.generate(base_scores.merge(comment: 'a' * 30)))

      expect(result).to be_a(Hash)
      expect(result[:comment].length).to eq(30)
    end
  end
end
