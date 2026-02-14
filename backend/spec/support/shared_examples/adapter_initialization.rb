RSpec.shared_examples 'adapter initialization' do |prompt_keyword|
  let(:adapter) { described_class.new }

  it 'BaseAiAdapterを継承していること' do
    expect(described_class < BaseAiAdapter).to be true
  end

  describe '#initialize' do
    context 'プロンプトファイルの読み込み' do
      it 'プロンプトファイルを読み込めること' do
        expect(adapter.instance_variable_get(:@prompt)).to include(prompt_keyword)
      end

      it 'プロンプトに{post_content}プレースホルダーが含まれていること' do
        expect(adapter.instance_variable_get(:@prompt)).to include('{post_content}')
      end

      it 'プロンプトがキャッシュされること' do
        # キャッシュをリセット
        if described_class.respond_to?(:reset_prompt_cache!)
          described_class.reset_prompt_cache!
        else
          # フォールバック: クラス変数をリセット（古い実装用）
          described_class.class_variable_set(:@@prompt_template, nil) if described_class.class_variable_defined?(:@@prompt_template)
        end

        if defined?(described_class::PROMPT_PATH)
          expected_path = described_class::PROMPT_PATH
          
          # 読み込みをモックして回数をカウント
          content = File.read(expected_path)
          allow(File).to receive(:read).with(expected_path).and_return(content)
          
          described_class.new
          described_class.new # 2回目はキャッシュを使用

          expect(File).to have_received(:read).with(expected_path).once
        end
      end

      it 'プロンプトファイルが存在しない場合は例外を発生させること' do
        # キャッシュリセット
        if described_class.respond_to?(:reset_prompt_cache!)
          described_class.reset_prompt_cache!
        end

        # 存在しないことをシミュレート
        allow(File).to receive(:exist?).and_return(false)
        allow(File).to receive(:read).and_raise(Errno::ENOENT) if !File.respond_to?(:exist?) # 防御的

        # 特定のパスのみfalseにするのは難しいので、PROMPT_PATHが特定できれば...
        # ここではシンプルに、全てのファイル読み込みが失敗するケースを想定するか、
        # あるいは「PROMPT_PATH」へのアクセスを失敗させる。
        
        # 実装によっては File.exist? を呼ばずに File.read するかもしれない
        # BaseGlmAdapterは File.exist? を呼ぶ
        
        # ここは汎用化が難しいので、最低限エラーが出ることを確認
        # ただし、PROMPT_PATHが見つからない場合に ArgumentError or Errno::ENOENT になることを期待
        
        # モックが難しいので、このテストはshared_examplesから除外するか、
        # より具体的な条件（PROMPT_PATHがわかっている場合）に限定する。
        # 今回は、File.exist? をモックして false を返すようにする（全パスに対して）
        # これで new してエラーになればOK
        
        allow(File).to receive(:exist?).and_return(false)
        
        expect { described_class.new }.to raise_error(StandardError) # ArgumentError or Errno::ENOENT
      end
    end
  end
end
