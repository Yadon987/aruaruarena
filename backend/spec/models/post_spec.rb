# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Post, type: :model do
  describe 'バリデーション' do
    subject { build(:post) }

    it '有効な属性であれば作成できること' do
      expect(subject).to be_valid
    end

    describe 'nickname' do
      it '1文字以上20文字以下であること' do
        subject.nickname = 'a'
        expect(subject).to be_valid

        subject.nickname = 'a' * 20
        expect(subject).to be_valid

        subject.nickname = ''
        expect(subject).not_to be_valid

        subject.nickname = 'a' * 21
        expect(subject).not_to be_valid
      end
    end

    describe 'body' do
      it '3文字以上30文字以下であること（grapheme単位）' do
        subject.body = 'abc'
        expect(subject).to be_valid

        subject.body = 'a' * 30
        expect(subject).to be_valid

        subject.body = 'ab'
        expect(subject).not_to be_valid

        subject.body = 'a' * 31
        expect(subject).not_to be_valid
      end

      it '絵文字もgraphemeとしてカウントすること' do
        subject.body = '😀😀😀'  # 3 grapheme clusters
        expect(subject).to be_valid

        subject.body = '😀😀'    # 2 grapheme clusters
        expect(subject).not_to be_valid
      end
    end

    describe 'status' do
      it 'judging/scored/failedのいずれかであること' do
        subject.status = 'judging'
        expect(subject).to be_valid

        subject.status = 'scored'
        expect(subject).to be_valid

        subject.status = 'failed'
        expect(subject).to be_valid

        subject.status = 'invalid'
        expect(subject).not_to be_valid
      end
    end

    describe 'average_score' do
      it '0〜100の範囲であること' do
        subject.status = 'scored'
        subject.average_score = 0
        expect(subject).to be_valid

        subject.average_score = 100
        expect(subject).to be_valid

        subject.average_score = -1
        expect(subject).not_to be_valid

        subject.average_score = 101
        expect(subject).not_to be_valid
      end

      it 'nilでも有効であること（審査前）' do
        subject.status = 'judging'
        subject.average_score = nil
        expect(subject).to be_valid
      end
    end

    describe 'judges_count' do
      it '0〜3の整数であること' do
        subject.judges_count = 0
        expect(subject).to be_valid

        subject.judges_count = 3
        expect(subject).to be_valid

        subject.judges_count = -1
        expect(subject).not_to be_valid

        subject.judges_count = 4
        expect(subject).not_to be_valid
      end
    end
  end

  describe '#generate_score_key' do
    let(:post) do
      build(:post,
            id: 'test-uuid',
            status: 'scored',
            average_score: 85.5,
            created_at: 1_738_041_600)
    end

    it '正しい形式のscore_keyを生成すること' do
      # inv_score = 1000 - (85.5 * 10) = 1000 - 855 = 145
      # score_key = "0145#1738041600#test-uuid"
      expect(post.generate_score_key).to eq('0145#01738041600#test-uuid')
    end

    it 'average_scoreがnilの場合はnilを返すこと' do
      post.average_score = nil
      expect(post.generate_score_key).to be_nil
    end
  end

  describe '#update_status!' do
    let(:post) { create(:post, status: 'judging', average_score: 85.0) }

    it 'scoredに変更するとscore_keyが設定されること' do
      post.update_status!('scored')
      expect(post.status).to eq('scored')
      expect(post.score_key).to be_present
    end

    it 'failedに変更するとscore_keyがnilになること' do
      post.update_status!('failed')
      expect(post.status).to eq('failed')
      expect(post.score_key).to be_nil
    end
  end

  describe '#calculate_rank' do
    before do
      # テストデータ作成
      create(:post, status: 'scored', average_score: 95.0, created_at: 1_738_040_000)
      create(:post, status: 'scored', average_score: 90.0, created_at: 1_738_041_000)
      create(:post, status: 'scored', average_score: 90.0, created_at: 1_738_040_000)
    end

    it '正しい順位を計算できること' do
      post = create(:post, status: 'scored', average_score: 85.0, created_at: 1_738_042_000)
      expect(post.calculate_rank).to eq(4) # 4位
    end

    it 'scored以外はnilを返すこと' do
      post = create(:post, status: 'judging')
      expect(post.calculate_rank).to be_nil
    end
  end
end
