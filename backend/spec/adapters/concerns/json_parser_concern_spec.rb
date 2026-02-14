# frozen_string_literal: true

require 'rails_helper'

RSpec.describe JsonParserConcern do
  # テスト用のダミークラス
  let(:test_class) do
    Class.new do
      include JsonParserConcern
    end
  end
  let(:instance) { test_class.new }

  # 必須スコアキー
  let(:required_keys) { %i[empathy humor brevity originality expression] }

  describe '#extract_json_from_codeblock' do
    context '```jsonパターン' do
      it '```jsonブロックからJSONを抽出すること' do
        text = "結果です:\n```json\n{\"empathy\": 10}\n```\n以上です"
        expect(instance.extract_json_from_codeblock(text)).to eq('{"empathy": 10}')
      end

      it '複数行のJSONを正しく抽出すること' do
        text = "```json\n{\"a\": 1,\n\"b\": 2}\n```"
        expect(instance.extract_json_from_codeblock(text)).to eq("{\"a\": 1,\n\"b\": 2}")
      end
    end

    context '```のみパターン（json指定なし）' do
      it '```のみのブロックからJSONを抽出すること' do
        text = "結果:\n```\n{\"empathy\": 15}\n```"
        expect(instance.extract_json_from_codeblock(text)).to eq('{"empathy": 15}')
      end

      it '複数行のJSONを正しく抽出すること' do
        text = "```\n{\"a\": 1,\n\"b\": 2}\n```"
        expect(instance.extract_json_from_codeblock(text)).to eq("{\"a\": 1,\n\"b\": 2}")
      end

      it '周囲にテキストがある場合も正しく抽出すること' do
        text = "AIの回答:\n```\n{\"test\": 1}\n```\n以上です"
        expect(instance.extract_json_from_codeblock(text)).to eq('{"test": 1}')
      end
    end

    context 'コードブロックなし' do
      it '元のテキストをそのまま返すこと' do
        text = '{"empathy": 10, "humor": 15}'
        expect(instance.extract_json_from_codeblock(text)).to eq(text)
      end

      it '空文字をそのまま返すこと' do
        expect(instance.extract_json_from_codeblock('')).to eq('')
      end
    end

    context '```jsonパターンが優先されること' do
      it '```と```jsonの両方がある場合```jsonを優先すること' do
        text = "```\nfirst\n```\n```json\n{\"a\": 1}\n```"
        expect(instance.extract_json_from_codeblock(text)).to eq('{"a": 1}')
      end
    end
  end

  describe '#convert_scores_to_integers' do
    let(:valid_data) do
      { empathy: 15, humor: 15, brevity: 15, originality: 15, expression: 15 }
    end

    context '整数値' do
      it '整数値をそのまま返すこと' do
        result = instance.convert_scores_to_integers(valid_data)
        expect(result[:empathy]).to eq(15)
      end

      it 'すべての必須キーが含まれること' do
        result = instance.convert_scores_to_integers(valid_data)
        expect(result.keys).to match_array(required_keys)
      end
    end

    context '文字列の整数' do
      it '文字列の整数を整数に変換すること' do
        data = { empathy: '15', humor: '10', brevity: '5', originality: '20', expression: '0' }
        result = instance.convert_scores_to_integers(data)
        expect(result[:empathy]).to eq(15)
      end
    end

    context 'Float値（四捨五入）' do
      it 'Float値を四捨五入して整数に変換すること' do
        data = { empathy: 15.7, humor: 10.2, brevity: 5.5, originality: 19.9, expression: 0.1 }
        result = instance.convert_scores_to_integers(data)
        expect(result[:empathy]).to eq(16)
        expect(result[:humor]).to eq(10)
        expect(result[:brevity]).to eq(6)
        expect(result[:originality]).to eq(20)
        expect(result[:expression]).to eq(0)
      end

      it '文字列の小数を四捨五入して整数に変換すること' do
        data = { empathy: '15.4', humor: '15.5', brevity: '15.6', originality: '14.4', expression: '0.5' }
        result = instance.convert_scores_to_integers(data)
        expect(result[:empathy]).to eq(15)
        expect(result[:humor]).to eq(16)
        expect(result[:brevity]).to eq(16)
        expect(result[:originality]).to eq(14)
        expect(result[:expression]).to eq(1)
      end

      it '境界値0.5を正しく丸めること' do
        data = { empathy: 0.5, humor: 0.4, brevity: 0.6, originality: 19.5, expression: 20.0 }
        result = instance.convert_scores_to_integers(data)
        expect(result[:empathy]).to eq(1)
        expect(result[:humor]).to eq(0)
        expect(result[:brevity]).to eq(1)
        expect(result[:originality]).to eq(20)
        expect(result[:expression]).to eq(20)
      end
    end

    context '無効な値' do
      it 'nil値の場合はArgumentErrorを発生させること' do
        data = { empathy: nil, humor: 10, brevity: 10, originality: 10, expression: 10 }
        expect { instance.convert_scores_to_integers(data) }.to raise_error(ArgumentError, /Score value is nil/)
      end

      it '無効な文字列の場合はArgumentErrorを発生させること' do
        data = { empathy: 'invalid', humor: 10, brevity: 10, originality: 10, expression: 10 }
        expect { instance.convert_scores_to_integers(data) }.to raise_error(ArgumentError, /Invalid score value/)
      end

      it 'Float::INFINITYの場合はArgumentErrorを発生させること' do
        data = { empathy: Float::INFINITY, humor: 10, brevity: 10, originality: 10, expression: 10 }
        expect { instance.convert_scores_to_integers(data) }.to raise_error(ArgumentError, /Invalid score value/)
      end

      it '-Float::INFINITYの場合はArgumentErrorを発生させること' do
        data = { empathy: -Float::INFINITY, humor: 10, brevity: 10, originality: 10, expression: 10 }
        expect { instance.convert_scores_to_integers(data) }.to raise_error(ArgumentError, /Invalid score value/)
      end

      it 'Float::NANの場合はArgumentErrorを発生させること' do
        data = { empathy: Float::NAN, humor: 10, brevity: 10, originality: 10, expression: 10 }
        expect { instance.convert_scores_to_integers(data) }.to raise_error(ArgumentError, /Invalid score value/)
      end
    end
  end

  describe '#truncate_comment' do
    context 'nil入力' do
      it 'nilを返すこと' do
        expect(instance.truncate_comment(nil)).to be_nil
      end
    end

    context '短いコメント' do
      it '最大長以内の場合はそのまま返すこと' do
        comment = '短いコメント'
        expect(instance.truncate_comment(comment)).to eq('短いコメント')
      end

      it '前後の空白を削除すること' do
        comment = '  コメント  '
        expect(instance.truncate_comment(comment)).to eq('コメント')
      end
    end

    context '長いコメント' do
      it '最大長を超える場合は切り詰めること' do
        comment = 'あ' * 50
        expect(instance.truncate_comment(comment).length).to eq(30)
      end

      it 'ちょうど30文字の場合はそのまま返すこと' do
        comment = 'あ' * 30
        expect(instance.truncate_comment(comment)).to eq(comment)
      end

      it '31文字の場合は30文字に切り詰めること' do
        comment = 'あ' * 31
        expect(instance.truncate_comment(comment).length).to eq(30)
      end
    end

    context 'カスタム最大長' do
      it 'カスタムの最大長を指定できること' do
        comment = 'あ' * 50
        expect(instance.truncate_comment(comment, max_length: 10).length).to eq(10)
      end
    end
  end
end
