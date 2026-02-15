# frozen_string_literal: true

require 'rails_helper'

RSpec.describe OgpMetaTagService, type: :service do
  describe '定数' do
    it 'DEFAULT_OGP_IMAGE_PATH定数が"/ogp/default.png"で定義されていること' do
      # 何を検証するか: 定数値が正しく設定されていること
      expect(described_class::DEFAULT_OGP_IMAGE_PATH).to eq('/ogp/default.png')
    end

    it 'MAX_DESCRIPTION_LENGTH定数が200で定義されていること' do
      # 何を検証するか: 定数値が正しく設定されていること
      expect(described_class::MAX_DESCRIPTION_LENGTH).to eq(200)
    end

    it 'ELLIPSIS定数が"..."で定義されていること' do
      # 何を検証するか: 定数値が正しく設定されていること
      expect(described_class::ELLIPSIS).to eq('...')
    end

    it 'SITE_NAME定数が"あるあるアリーナ"で定義されていること' do
      # 何を検証するか: 定数値が正しく設定されていること
      expect(described_class::SITE_NAME).to eq('あるあるアリーナ')
    end

    it 'LOCALE定数が"ja_JP"で定義されていること' do
      # 何を検証するか: 定数値が正しく設定されていること
      expect(described_class::LOCALE).to eq('ja_JP')
    end

    it 'OG_TYPE定数が"article"で定義されていること' do
      # 何を検証するか: 定数値が正しく設定されていること
      expect(described_class::OG_TYPE).to eq('article')
    end

    it 'TWITTER_CARD定数が"summary_large_image"で定義されていること' do
      # 何を検証するか: 定数値が正しく設定されていること
      expect(described_class::TWITTER_CARD).to eq('summary_large_image')
    end
  end

  describe '.crawler?' do
    context '正常系 (Happy Path)' do
      it 'Twitterbotを含むUser-Agentでtrueを返すこと' do
        # 何を検証するか: Twitterbotを含むUser-Agentをクローラーとして判定できること
        expect(described_class.crawler?(user_agent: 'Twitterbot/1.0')).to be true
      end

      it 'facebookexternalhitを含むUser-Agentでtrueを返すこと' do
        # 何を検証するか: facebookexternalhitを含むUser-Agentをクローラーとして判定できること
        expect(described_class.crawler?(user_agent: 'facebookexternalhit/1.1')).to be true
      end

      it 'line-pokerを含むUser-Agentでtrueを返すこと' do
        # 何を検証するか: line-pokerを含むUser-Agentをクローラーとして判定できること
        expect(described_class.crawler?(user_agent: 'line-poker/1.0')).to be true
      end

      it 'Discordbotを含むUser-Agentでtrueを返すこと' do
        # 何を検証するか: Discordbotを含むUser-Agentをクローラーとして判定できること
        expect(described_class.crawler?(user_agent: 'Discordbot/1.0')).to be true
      end

      it 'Slackbotを含むUser-Agentでtrueを返すこと' do
        # 何を検証するか: Slackbotを含むUser-Agentをクローラーとして判定できること
        expect(described_class.crawler?(user_agent: 'Slackbot/1.0')).to be true
      end

      # rubocop:disable Layout/LineLength
      it '通常のブラウザ（Chrome）でfalseを返すこと' do
        # 何を検証するか: 通常のブラウザをクローラーとして判定しないこと
        expect(described_class.crawler?(user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')).to be false
      end

      it '通常のブラウザ（Safari）でfalseを返すこと' do
        # 何を検証するか: 通常のブラウザをクローラーとして判定しないこと
        expect(described_class.crawler?(user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15')).to be false
      end

      it '通常のブラウザ（Firefox）でfalseを返すこと' do
        # 何を検証するか: 通常のブラウザをクローラーとして判定しないこと
        expect(described_class.crawler?(user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0')).to be false
      end
      # rubocop:enable Layout/LineLength

      it 'curlでfalseを返すこと' do
        # 何を検証するか: curlをクローラーとして判定しないこと
        expect(described_class.crawler?(user_agent: 'curl/7.68.0')).to be false
      end
    end

    context '異常系 (Error Path)' do
      it '空文字列でfalseを返すこと' do
        # 何を検証するか: 空文字列をクローラーとして判定しないこと
        expect(described_class.crawler?(user_agent: '')).to be false
      end

      it 'nilでfalseを返すこと' do
        # 何を検証するか: nilをクローラーとして判定しないこと
        expect(described_class.crawler?(user_agent: nil)).to be false
      end

      it '不正な形式のUser-Agent（数値）でfalseを返すこと' do
        # 何を検証するか: 不正な形式をクローラーとして判定しないこと
        expect(described_class.crawler?(user_agent: 12_345)).to be false
      end

      it '不正な形式のUser-Agent（配列）でfalseを返すこと' do
        # 何を検証するか: 不正な形式をクローラーとして判定しないこと
        expect(described_class.crawler?(user_agent: ['invalid'])).to be false
      end
    end

    context '境界値 (Edge Case)' do
      it 'クローラー文字列と完全一致する場合、trueを返すこと' do
        # 何を検証するか: クローラー文字列と完全一致する場合も判定できること
        expect(described_class.crawler?(user_agent: 'Twitterbot')).to be true
      end

      it 'クローラー文字列が先頭にある場合、trueを返すこと' do
        # 何を検証するか: クローラー文字列が先頭にある場合も判定できること
        expect(described_class.crawler?(user_agent: 'Twitterbot/1.0 (+https://twitter.com/bot)')).to be true
      end

      it 'クローラー文字列が末尾にある場合、trueを返すこと' do
        # 何を検証するか: クローラー文字列が末尾にある場合も判定できること
        expect(described_class.crawler?(user_agent: 'Mozilla/5.0 ... Twitterbot')).to be true
      end

      it 'クローラー文字列が中間にある場合、trueを返すこと' do
        # 何を検証するか: クローラー文字列が中間にある場合も判定できること
        expect(described_class.crawler?(user_agent: 'Mozilla/5.0 Twitterbot/1.0 (compatible)')).to be true
      end

      it '大文字小文字を区別しないこと' do
        # 何を検証するか: 大文字小文字を区別せずに判定できること
        expect(described_class.crawler?(user_agent: 'twitterbot/1.0')).to be true
        expect(described_class.crawler?(user_agent: 'TWITTERBOT/1.0')).to be true
        expect(described_class.crawler?(user_agent: 'TwitterBot/1.0')).to be true
      end
    end
  end

  describe '.generate_html' do
    let(:post) do
      create(:post, :scored,
             nickname: '太郎',
             body: 'スヌーズ押して二度寝',
             average_score: 85.5)
    end
    let(:base_url) { 'https://example.com' }

    context '正常系 (Happy Path)' do
      it '正しいOGPタグが含まれるHTMLを返すこと' do
        # 何を検証するか: 必要なOGPタグがすべて含まれること
        html = described_class.generate_html(post:, base_url:)

        expect(html).to include('<meta property="og:title"')
        expect(html).to include('<meta property="og:type"')
        expect(html).to include('<meta property="og:url"')
        expect(html).to include('<meta property="og:image"')
        expect(html).to include('<meta property="og:description"')
        expect(html).to include('<meta property="og:site_name"')
        expect(html).to include('<meta property="og:locale"')
        expect(html).to include('<meta name="twitter:card"')
      end

      it '完全なHTML構造を持っていること' do
        # 何を検証するか: <!DOCTYPE html>, <html>, <head>, <body> が含まれていること
        html = described_class.generate_html(post:, base_url:)

        expect(html).to include('<!DOCTYPE html>')
        expect(html).to include('<html')
        expect(html).to include('<head>')
        expect(html).to include('</head>')
        expect(html).to include('<body>')
        expect(html).to include('</body>')
        expect(html).to include('</html>')
      end

      it 'og:titleに正しいタイトルが設定されること' do
        # 何を検証するか: タイトルが正しく設定されていること
        html = described_class.generate_html(post:, base_url:)

        expect(html).to include('太郎さんのあるある投稿 | あるあるアリーナ')
      end

      it 'og:typeに"article"が設定されること' do
        # 何を検証するか: og:typeが正しく設定されていること
        html = described_class.generate_html(post:, base_url:)

        expect(html).to include('property="og:type" content="article"')
      end

      it 'og:urlに正しいURLが設定されること' do
        # 何を検証するか: URLが正しく設定されていること
        html = described_class.generate_html(post:, base_url:)

        expect(html).to include("property=\"og:url\" content=\"#{base_url}/posts/#{post.id}\"")
      end

      it 'og:imageに正しい画像パスが設定されること' do
        # 何を検証するか: 画像パスが正しく設定されていること
        html = described_class.generate_html(post:, base_url:)

        expect(html).to include("property=\"og:image\" content=\"#{base_url}/ogp/posts/#{post.id}.png\"")
      end

      it 'og:descriptionに正しい説明文が設定されること' do
        # 何を検証するか: 説明文が正しく設定されていること
        html = described_class.generate_html(post:, base_url:)

        expect(html).to include('スヌーズ押して二度寝 (スコア: 85.5点)')
      end

      it 'og:site_nameに"あるあるアリーナ"が設定されること' do
        # 何を検証するか: サイト名が正しく設定されていること
        html = described_class.generate_html(post:, base_url:)

        expect(html).to include('property="og:site_name" content="あるあるアリーナ"')
      end

      it 'og:localeに"ja_JP"が設定されること' do
        # 何を検証するか: ロケールが正しく設定されていること
        html = described_class.generate_html(post:, base_url:)

        expect(html).to include('property="og:locale" content="ja_JP"')
      end

      it 'twitter:cardに"summary_large_image"が設定されること' do
        # 何を検証するか: Twitterカードタイプが正しく設定されていること
        html = described_class.generate_html(post:, base_url:)

        expect(html).to include('name="twitter:card" content="summary_large_image"')
      end
    end

    context 'XSS対策' do
      it 'タイトルにHTMLタグが含まれる場合、エスケープされること' do
        # 何を検証するか: XSS攻撃を防ぐためにHTMLエスケープが行われること
        # バリデーションを回避するためにbuild_stubbedを使用
        malicious_post = build_stubbed(:post, id: SecureRandom.uuid, nickname: '<script>alert("XSS")</script>',
                                              body: 'テスト', average_score: 50.0)
        html = described_class.generate_html(post: malicious_post, base_url:)

        expect(html).to include('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;')
        expect(html).not_to include('<script>')
      end

      it '説明文にHTMLタグが含まれる場合、エスケープされること' do
        # 何を検証するか: XSS攻撃を防ぐためにHTMLエスケープが行われること
        # バリデーションを回避するためにbuild_stubbedを使用
        malicious_post = build_stubbed(:post, id: SecureRandom.uuid, nickname: '太郎',
                                              body: '<img src=x onerror=alert(1)>', average_score: 50.0)
        html = described_class.generate_html(post: malicious_post, base_url:)

        expect(html).to include('&lt;img src=x onerror=alert(1)&gt;')
        expect(html).not_to include('<img')
      end

      it 'タイトルにJavaScriptイベントハンドラが含まれる場合、エスケープされること' do
        # 何を検証するか: XSS攻撃を防ぐためにHTMLエスケープが行われること
        # バリデーションを回避するためにbuild_stubbedを使用
        malicious_post = build_stubbed(:post, id: SecureRandom.uuid, nickname: '太郎" onmouseover="alert(1)',
                                              body: 'テスト', average_score: 50.0)
        html = described_class.generate_html(post: malicious_post, base_url:)

        expect(html).to include('太郎&quot; onmouseover=&quot;alert(1)さんのあるある投稿')
        # エスケープされた文字列に元のイベントハンドラが含まれていないことを確認
        expect(html).not_to include('太郎" onmouseover="alert(1)"')
      end
    end

    context '境界値 (Edge Case)' do
      it '説明文がちょうど200文字の場合、省略なしで表示されること' do
        # 何を検証するか: ちょうど200文字の場合は省略されないこと
        # バリデーションを回避するためにbuild_stubbedを使用
        long_body = 'あ' * 189
        long_post = build_stubbed(:post, id: SecureRandom.uuid, nickname: '太郎',
                                         body: long_body, average_score: 50.0)
        html = described_class.generate_html(post: long_post, base_url:)

        expect(html).to include('property="og:description" content="')
        description_match = html.match(/property="og:description" content="([^"]+)"/)
        expect(description_match).not_to be_nil
        description = description_match[1]
        expect(description.length).to eq(200)
        expect(description).to end_with(' (スコア: 50点)')
      end

      it '説明文が201文字の場合、末尾が...で省略されること' do
        # 何を検証するか: 200文字を超える場合は省略されること
        # バリデーションを回避するためにbuild_stubbedを使用
        long_body = 'あ' * 190
        long_post = build_stubbed(:post, id: SecureRandom.uuid, nickname: '太郎',
                                         body: long_body, average_score: 50.0)
        html = described_class.generate_html(post: long_post, base_url:)

        description_match = html.match(/property="og:description" content="([^"]+)"/)
        expect(description_match).not_to be_nil
        description = description_match[1]
        expect(description.length).to eq(200)
        expect(description).to end_with('... (スコア: 50点)')
      end

      it '空文字のニックネームでもHTMLが生成されること' do
        # 何を検証するか: 空文字のニックネームでも正常にHTMLが生成されること
        # バリデーションを回避するためにbuild_stubbedを使用
        post_with_empty_nickname = build_stubbed(:post, id: SecureRandom.uuid, nickname: '',
                                                        body: 'テスト', average_score: 50.0)
        html = described_class.generate_html(post: post_with_empty_nickname, base_url:)

        expect(html).to include('さんのあるある投稿 | あるあるアリーナ')
      end

      it 'nilの平均スコアでもHTMLが生成されること' do
        # 何を検証するか: nilスコアでも正常にHTMLが生成されること
        post_with_nil_score = create(:post, :scored, nickname: '太郎', body: 'テスト', average_score: nil)
        html = described_class.generate_html(post: post_with_nil_score, base_url:)

        expect(html).to include(' (スコア: 未評価)')
      end

      it '0点でもHTMLが生成されること' do
        # 何を検証するか: 0点でも正常にHTMLが生成されること
        post_with_zero_score = create(:post, :scored, nickname: '太郎', body: 'テスト', average_score: 0.0)
        html = described_class.generate_html(post: post_with_zero_score, base_url:)

        expect(html).to include(' (スコア: 0点)')
      end

      it '100点でもHTMLが生成されること' do
        # 何を検証するか: 100点でも正常にHTMLが生成されること
        post_with_max_score = create(:post, :scored, nickname: '太郎', body: 'テスト', average_score: 100.0)
        html = described_class.generate_html(post: post_with_max_score, base_url:)

        expect(html).to include(' (スコア: 100点)')
      end

      it 'base_urlの末尾にスラッシュがある場合でも、正しいURLが生成されること' do
        # 何を検証するか: URL結合時にスラッシュが重複しないこと
        base_url_slash = 'https://example.com/'
        html = described_class.generate_html(post:, base_url: base_url_slash)

        # 末尾のスラッシュが削除されていることを確認
        expect(html).to include("property=\"og:url\" content=\"https://example.com/posts/#{post.id}\"")
        # 重複スラッシュがないことを確認 (http://...//posts/...)
        expect(html).not_to include('//posts/')
      end
    end
  end

  describe '.generate_description' do
    context '正常系 (Happy Path)' do
      it '正常な本文とスコアで説明文が生成されること' do
        # 何を検証するか: 本文とスコアから正しく説明文が生成されること
        description = described_class.generate_description(body: 'スヌーズ押して二度寝', average_score: 85.5)

        expect(description).to eq('スヌーズ押して二度寝 (スコア: 85.5点)')
      end

      it '本文が30文字以内の場合、全文が含まれること' do
        # 何を検証するか: 短い本文でも正しく処理されること
        description = described_class.generate_description(body: 'あいうえお', average_score: 50.0)

        expect(description).to eq('あいうえお (スコア: 50点)')
      end
    end

    context '境界値 (Edge Case)' do
      it '説明文がちょうど200文字の場合、省略なしで返されること' do
        # 何を検証するか: ちょうど200文字の場合は省略されないこと
        body = 'あ' * 189
        description = described_class.generate_description(body:, average_score: 50.0)

        expect(description.length).to eq(200)
        expect(description).to end_with(' (スコア: 50点)')
      end

      it '説明文が201文字の場合、末尾が...で省略されること' do
        # 何を検証するか: 200文字を超える場合は省略されること
        body = 'あ' * 190
        description = described_class.generate_description(body:, average_score: 50.0)

        expect(description.length).to eq(200)
        expect(description).to end_with('... (スコア: 50点)')
      end

      it '本文が200文字を超える場合、適切に省略されること' do
        # 何を検証するか: 200文字を超える場合は省略されること
        body = 'あ' * 300
        description = described_class.generate_description(body:, average_score: 50.0)

        expect(description.length).to eq(200)
        expect(description).to end_with('... (スコア: 50点)')
        expect(description).not_to include('あ' * 197)
      end

      it '平均スコアが整数の場合、小数点が含まれないこと' do
        # 何を検証するか: 整数スコアの場合は小数点が表示されないこと
        description = described_class.generate_description(body: 'テスト', average_score: 85)

        expect(description).to eq('テスト (スコア: 85点)')
      end

      it '平均スコアが小数点以下0の場合、.0が表示されないこと' do
        # 何を検証するか: 小数点以下0の場合は.0が表示されないこと
        description = described_class.generate_description(body: 'テスト', average_score: 85.0)

        expect(description).to eq('テスト (スコア: 85点)')
      end
    end

    context '異常系 (Error Path)' do
      it '本文が空文字の場合、空文字+スコアが返されること' do
        # 何を検証するか: 空文字でも正常に処理されること
        description = described_class.generate_description(body: '', average_score: 50.0)

        expect(description).to eq(' (スコア: 50点)')
      end

      it '本文がnilの場合、空文字+スコアが返されること' do
        # 何を検証するか: nilでも正常に処理されること
        description = described_class.generate_description(body: nil, average_score: 50.0)

        expect(description).to eq(' (スコア: 50点)')
      end

      it '平均スコアがnilの場合、本文のみが返されること' do
        # 何を検証するか: nilスコアでも正常に処理されること
        description = described_class.generate_description(body: 'テスト', average_score: nil)

        expect(description).to eq('テスト (スコア: 未評価)')
      end

      it '平均スコアが0.0の場合、0点と表示されること' do
        # 何を検証するか: 0.0点でも正常に処理されること
        description = described_class.generate_description(body: 'テスト', average_score: 0.0)

        expect(description).to eq('テスト (スコア: 0点)')
      end

      it '平均スコアが100.0の場合、100点と表示されること' do
        # 何を検証するか: 100.0点でも正常に処理されること
        description = described_class.generate_description(body: 'テスト', average_score: 100.0)

        expect(description).to eq('テスト (スコア: 100点)')
      end
    end
  end

  describe '.escape_html' do
    context 'XSS対策' do
      it 'scriptタグがエスケープされること' do
        # 何を検証するか: XSS攻撃を防ぐためにscriptタグがエスケープされること
        escaped = described_class.escape_html('<script>alert("XSS")</script>')

        expect(escaped).to eq('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;')
        expect(escaped).not_to include('<script>')
      end

      it 'imgタグがエスケープされること' do
        # 何を検証するか: XSS攻撃を防ぐためにimgタグがエスケープされること
        escaped = described_class.escape_html('<img src=x onerror=alert(1)>')

        expect(escaped).to eq('&lt;img src=x onerror=alert(1)&gt;')
        expect(escaped).not_to include('<img')
      end

      it 'ダブルクォートがエスケープされること' do
        # 何を検証するか: 属性値のエスケープとしてダブルクォートがエスケープされること
        escaped = described_class.escape_html('テスト"テスト')

        expect(escaped).to eq('テスト&quot;テスト')
        expect(escaped).not_to include('"')
      end

      it 'シングルクォートがエスケープされること' do
        # 何を検証するか: 属性値のエスケープとしてシングルクォートがエスケープされること
        escaped = described_class.escape_html("テスト'テスト")

        expect(escaped).to eq('テスト&#39;テスト')
        expect(escaped).not_to include("'")
      end

      it '不等号がエスケープされること' do
        # 何を検証するか: HTMLタグの不等号がエスケープされること
        escaped = described_class.escape_html('<div>テスト</div>')

        expect(escaped).to eq('&lt;div&gt;テスト&lt;/div&gt;')
        expect(escaped).not_to include('<')
        expect(escaped).not_to include('>')
      end

      it 'アンパサンドがエスケープされること' do
        # 何を検証するか: アンパサンドがエスケープされること
        escaped = described_class.escape_html('テスト&テスト')

        expect(escaped).to eq('テスト&amp;テスト')
      end
    end

    context 'エッジケース (Edge Case)' do
      it '既にエスケープされた文字列は二重エスケープされないこと' do
        # 何を検証するか: 二重エスケープを防止すること（現実には発生しないが、エスケープ対象の文字列が含まれていなければそのまま返される）
        escaped = described_class.escape_html('&lt;script&gt;')

        expect(escaped).to eq('&amp;lt;script&amp;gt;')
      end

      it '空文字の場合、空文字が返されること' do
        # 何を検証するか: 空文字が正常に処理されること
        escaped = described_class.escape_html('')

        expect(escaped).to eq('')
      end

      it 'nilの場合、空文字が返されること' do
        # 何を検証するか: nilが正常に処理されること
        escaped = described_class.escape_html(nil)

        expect(escaped).to eq('')
      end
    end
  end

  describe '.truncate_description' do
    context '正常系 (Happy Path)' do
      it '200文字以内の場合、省略なしで返されること' do
        # 何を検証するか: 200文字以内の場合は省略されないこと
        text = 'あ' * 200
        truncated = described_class.truncate_description(text:, max_length: 200)

        expect(truncated).to eq(text)
        expect(truncated.length).to eq(200)
      end

      it '200文字を超える場合、末尾が...で省略されること' do
        # 何を検証するか: 200文字を超える場合は省略されること
        text = 'あ' * 250
        truncated = described_class.truncate_description(text:, max_length: 200)

        expect(truncated.length).to eq(200)
        expect(truncated).to end_with('...')
      end

      it '省略後も最大長以下であること' do
        # 何を検証するか: 省略後も最大長以下であること
        text = 'あ' * 300
        truncated = described_class.truncate_description(text:, max_length: 200)

        expect(truncated.length).to be <= 200
      end
    end

    context '境界値 (Edge Case)' do
      it 'ちょうど200文字の場合、省略なしで返されること' do
        # 何を検証するか: ちょうど200文字の場合は省略されないこと
        text = 'あ' * 200
        truncated = described_class.truncate_description(text:, max_length: 200)

        expect(truncated).to eq(text)
        expect(truncated).not_to end_with('...')
      end

      it '201文字の場合、末尾が...で省略されること' do
        # 何を検証するか: 200文字を超える場合は省略されること
        text = 'あ' * 201
        truncated = described_class.truncate_description(text:, max_length: 200)

        expect(truncated.length).to eq(200)
        expect(truncated).to end_with('...')
      end

      it '1文字の場合、省略なしで返されること' do
        # 何を検証するか: 短いテキストも正常に処理されること
        text = 'あ'
        truncated = described_class.truncate_description(text:, max_length: 200)

        expect(truncated).to eq('あ')
      end
    end

    context '異常系 (Error Path)' do
      it '空文字の場合、空文字が返されること' do
        # 何を検証するか: 空文字が正常に処理されること
        truncated = described_class.truncate_description(text: '', max_length: 200)

        expect(truncated).to eq('')
      end

      it 'nilの場合、空文字が返されること' do
        # 何を検証するか: nilが正常に処理されること
        truncated = described_class.truncate_description(text: nil, max_length: 200)

        expect(truncated).to eq('')
      end

      it '最大長が0の場合、空文字が返されること' do
        # 何を検証するか: 最大長0の場合は空文字が返ること
        text = 'あ' * 10
        truncated = described_class.truncate_description(text:, max_length: 0)

        expect(truncated).to eq('')
      end

      it '最大長がマイナスの場合、空文字が返されること' do
        # 何を検証するか: 最大長マイナスの場合は空文字が返ること
        text = 'あ' * 10
        truncated = described_class.truncate_description(text:, max_length: -10)

        expect(truncated).to eq('')
      end
    end
  end
end
