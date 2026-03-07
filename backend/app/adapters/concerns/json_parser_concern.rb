# frozen_string_literal: true

# JsonParserConcern - AI Adapter共通のJSONパース処理
module JsonParserConcern
  extend ActiveSupport::Concern

  NORMALIZED_SCORE_RANGE = (0..20)

  # AIレスポンスから有効なスコアJSONを探し出してパースする
  def parse_json_payload(text)
    # 候補1: コードブロック
    valid_data = find_valid_json_in_candidates(extract_all_code_blocks(text))
    return valid_data if valid_data

    # 候補2: 全文検索（JSONオブジェクトらしきもの）
    valid_data = find_valid_json_in_candidates(extract_all_json_objects(text))
    return valid_data if valid_data

    # 候補3: 末尾切れしたJSONの簡易補完
    valid_data = parse_repaired_json_candidate(text)
    return valid_data if valid_data

    Rails.logger.warn("[JsonParserConcern] Valid JSON not found in text: #{text.to_s.truncate(100)}")
    raise JSON::ParserError, 'No valid score JSON found in response'
  end

  # (Legacy method for compatibility, if needed)
  def extract_json_from_codeblock(text)
    return text unless text.is_a?(String) && text.include?('```')

    normalized = text.gsub("\r\n", "\n")
    # ```json ... ``` を優先
    json_blocks = normalized.scan(/```json\s*(.*?)\s*```/mi).flatten
    return json_blocks.first.strip if json_blocks.any?

    # ``` ... ``` をフォールバック
    all_blocks = extract_all_code_blocks(normalized)
    all_blocks.first || text
  end

  def convert_scores_to_integers(data)
    BaseAiAdapter::REQUIRED_SCORE_KEYS.index_with { |key| normalize_score_value(fetch_score_value(data, key), key) }
  end

  # commentを検証・サニタイズして切り詰める
  # 不正な文字（ダブルクォート、改行、タブ、バックスラッシュ、中括弧）を削除
  def truncate_comment(comment, max_length: 30)
    return nil if comment.nil?

    sanitized = sanitize_comment(comment)
    sanitized[0...max_length]
  end

  # commentフィールドから不正な文字を削除する
  # プロンプト指示に従わない場合の安全策
  def sanitize_comment(comment)
    return nil if comment.nil?

    comment.to_s.strip
           .gsub(/["\r\n\t\\{}]/, '') # 不正文字を削除
  end

  private

  def extract_all_code_blocks(text)
    return [] unless text.is_a?(String) && text.include?('```')

    # 非貪欲マッチ(.*?)で複数のブロックを正しく取得
    text.gsub("\r\n", "\n").scan(/```(?:json)?\s*(.*?)\s*```/mi).flatten.map(&:strip)
  end

  def extract_all_json_objects(text)
    text.is_a?(String) ? collect_json_objects(text) : []
  end

  def find_valid_json_in_candidates(candidates)
    candidates.each do |candidate|
      json = parse_candidate_json(candidate)
      return json if valid_score_json?(json)
    end
    nil
  end

  def fetch_score_value(data, key)
    value = data[key] || data[key.to_s]
    # nilチェックはここで厳密に行う
    value.nil? ? raise(ArgumentError, "Score value is nil for #{key}") : value
  end

  def normalize_score_value(value, key)
    score = if value.is_a?(Integer)
              value
            else
              # 文字列の場合の柔軟なパース処理
              # "8/10", "8点", "Score: 8" などに対応
              str_val = value.to_s

              # スラッシュが含まれる場合 (例: "8/10") は分子を取る
              str_val = str_val.split('/').first if str_val.include?('/')

              # 数値部分を抽出
              # 整数または小数をマッチさせる
              match = str_val.match(/(-?\d+(?:\.\d+)?)/)

              raise ArgumentError, "Invalid score value format for #{key}: #{value.inspect}" unless match

              Float(match[1]).round
            end

    return score if NORMALIZED_SCORE_RANGE.cover?(score)

    raise ArgumentError, "Score out of range for #{key}: #{score}"
  rescue ArgumentError, RangeError, TypeError => e
    raise ArgumentError, "Invalid score value for #{key}: #{value.inspect} - #{e.message}"
  end

  # 文字列全体からJSONオブジェクト({ ... })をすべて抽出する
  # 以前のバグ（breakしてしまう問題）を修正
  def collect_json_objects(text)
    results = []
    scan_pos = 0

    while (start_index = text.index('{', scan_pos))
      candidate = extract_json_object_from(text, start_index)
      results << candidate if candidate
      scan_pos = start_index + 1
    end
    results
  end

  # 指定位置から始まるJSONオブジェクトらしき文字列を抽出
  # 括弧の深さをカウントして閉じる位置を探す
  def extract_json_object_from(text, start_index)
    state = initial_json_scan_state

    text[start_index..].each_char.with_index do |char, index|
      advance_json_scan_state(state, char)

      # 深さが0になったらオブジェクト終了
      return text[start_index, index + 1] if json_object_closed?(state)
    end

    # 最後まで閉じなかった場合
    nil
  end

  def initial_json_scan_state
    { depth: 0, in_string: false, escaped: false }
  end

  def advance_json_scan_state(state, char)
    return advance_string_state(state, char) if state[:in_string]

    advance_plain_state(state, char)
  end

  def advance_string_state(state, char)
    if state[:escaped]
      state[:escaped] = false
    elsif char == '\\'
      state[:escaped] = true
    elsif char == '"'
      state[:in_string] = false
    end
  end

  def advance_plain_state(state, char)
    case char
    when '"'
      state[:in_string] = true
    when '{'
      state[:depth] += 1
    when '}'
      state[:depth] -= 1
    end
  end

  def json_object_closed?(state)
    state[:depth].zero?
  end

  def parse_candidate_json(candidate)
    JSON.parse(candidate, symbolize_names: true)
  rescue JSON::ParserError
    nil
  end

  def parse_repaired_json_candidate(text)
    candidate = repair_truncated_json_candidate(text)
    return nil if candidate.nil?

    json = parse_candidate_json(candidate)
    valid_score_json?(json) ? json : nil
  end

  def repair_truncated_json_candidate(text)
    return nil unless text.is_a?(String)

    candidate = text.strip
    return nil unless candidate.start_with?('{')

    state = initial_json_scan_state
    candidate.each_char { |char| advance_json_scan_state(state, char) }

    repaired = candidate.dup
    repaired << '"' if state[:in_string]
    repaired << ('}' * state[:depth]) if state[:depth].positive?
    repaired
  end

  def valid_score_json?(json)
    return false unless json.is_a?(Hash)

    # 必須キーが含まれているかチェック (シンボル/文字列両対応)
    required_score_keys.all? do |key|
      json.key?(key) || json.key?(key.to_s)
    end
  end

  def required_score_keys
    BaseAiAdapter::REQUIRED_SCORE_KEYS
  end
end
