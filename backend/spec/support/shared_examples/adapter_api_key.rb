RSpec.shared_examples 'adapter api key validation' do |env_key, error_message_pattern = nil|
  error_message_pattern ||= /API_KEYが設定されていません/

  describe '#api_key' do
    context '正常系' do
      it '環境変数からAPIキーを取得できること' do
        stub_env(env_key, 'test_api_key_12345')
        expect(adapter.send(:api_key)).to eq('test_api_key_12345')
      end
    end

    context '異常系' do
      it 'APIキーが設定されていない場合は例外を発生させること' do
        stub_env(env_key, nil)
        expect { adapter.send(:api_key) }.to raise_error(ArgumentError, error_message_pattern)
      end

      it 'APIキーが空文字の場合は例外を発生させること' do
        stub_env(env_key, '')
        expect { adapter.send(:api_key) }.to raise_error(ArgumentError, error_message_pattern)
      end

      it 'APIキーが空白のみの場合は例外を発生させること' do
        stub_env(env_key, '   ')
        expect { adapter.send(:api_key) }.to raise_error(ArgumentError, error_message_pattern)
      end
    end
  end
end
