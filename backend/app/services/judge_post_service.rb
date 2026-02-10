# frozen_string_literal: true

# JudgePostService - 投稿のAI審査を実行するサービス
#
# 投稿に対して3人のAI審査員（ひろゆき風/デヴィ婦人風/中尾彬風）による
# 並列審査を実行し、その結果をJudgmentテーブルに保存します。
#
# @note 本実装はE06-05で行い、本issueではスタブとしてNotImplementedErrorをraiseします
# @note Thread.newで非同期実行されるため、Thread内の例外はレスポンスに影響しません
# @note Postが削除されている場合（@post == nil）は、審査をスキップしてWARNログを出力します
class JudgePostService
  # 投稿の審査を実行
  #
  # @param post_id [String] 投稿ID
  # @return [void]
  def self.call(post_id)
    new(post_id).execute
  end

  # 初期化
  #
  # Post.findで投稿を取得し、存在しない場合はWARNログを出力して@postをnilに設定
  # Thread内でRecordNotFoundが発生しても、Thread外のレスポンスには影響しません
  #
  # @param post_id [String] 投稿ID
  def initialize(post_id)
    @post = Post.find(post_id)
  rescue Dynamoid::Errors::RecordNotFound
    Rails.logger.warn("[JudgePostService] Post not found: #{post_id}")
    @post = nil
  end

  # 審査を実行
  #
  # TODO: E06-05で実装
  # 1. 3人のAI審査員による並列審査
  # 2. 審査結果のJudgmentテーブルへの保存
  # 3. 投稿ステータスの更新（judging → scored/failed）
  #
  # @return [void]
  # @raise [NotImplementedError] 本実装はE06-05で行う
  def execute
    return if @post.nil? # Postが削除されている場合はスキップ

    raise NotImplementedError, 'JudgePostService#execute is not implemented yet (E06-05)'
  end
end
