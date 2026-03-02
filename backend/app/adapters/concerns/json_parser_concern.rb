# frozen_string_literal: true

# JsonParserConcern - AI Adapter共通のJSONパース処理
module JsonParserConcern
  extend ActiveSupport::Concern

  def parse_json_payload(text)
    valid_data = find_valid_json_in_candidates(extract_all_code_blocks(text))
    valid_data ||= find_valid_json_in_candidates(extract_all_json_objects(text))
    return valid_data if valid_data

    Rails.logger.warn("[JsonParserConcern] Valid JSON not found in text: #{text.to_s.truncate(100)}")
    raise JSON::ParserError, 'No valid score JSON found in response'
  end

  def extract_json_from_codeblock(text)
    return text unless text.is_a?(String) && text.include?('```')

    normalized = text.gsub("\r\n", "\n")
    json_blocks = normalized.scan(/```json\s*(.*?)\s*```/mi).flatten
    return json_blocks.first if json_blocks.any?

    extract_all_code_blocks(normalized).first || text
  end

  def convert_scores_to_integers(data)
    BaseAiAdapter::REQUIRED_SCORE_KEYS.index_with { |key| normalize_score_value(fetch_score_value(data, key), key) }
  end

  def truncate_comment(comment, max_length: 30)
    comment.nil? ? nil : comment.to_s.strip[0...max_length]
  end

  private

  def extract_all_code_blocks(text)
    return [] unless text.is_a?(String) && text.include?('```')

    text.gsub("\r\n", "\n").scan(/```(?:json)?\s*(.*?)\s*```/mi).flatten
  end

  def extract_all_json_objects(text) = text.is_a?(String) ? collect_json_objects(text) : []

  def find_valid_json_in_candidates(candidates)
    candidates.each do |candidate|
      json = parse_candidate_json(candidate)
      return json if valid_score_json?(json)
    end
    nil
  end

  def fetch_score_value(data, key)
    value = data[key] || data[key.to_s]
    value.nil? ? raise(ArgumentError, "Score value is nil for #{key}") : value
  end

  def normalize_score_value(value, key)
    return value if value.is_a?(Integer)

    Float(value).round
  rescue ArgumentError, RangeError, TypeError
    raise ArgumentError, "Invalid score value for #{key}: #{value.inspect}"
  end

  def collect_json_objects(text)
    results = []
    scan_pos = 0
    while (start_index = text.index('{', scan_pos))
      candidate = extract_json_object_from(text, start_index)
      break unless candidate

      results << candidate
      scan_pos = start_index + 1
    end
    results
  end

  def extract_json_object_from(text, start_index)
    state = initial_json_scan_state
    text[start_index..].each_char.with_index do |char, index|
      advance_json_scan_state(state, char)
      return text[start_index, index + 1] if json_object_closed?(state)
    end
    nil
  end

  def initial_json_scan_state = { depth: 0, in_string: false, escaped: false }

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

  def json_object_closed?(state) = state[:depth].zero?

  def parse_candidate_json(candidate)
    JSON.parse(candidate, symbolize_names: true)
  rescue JSON::ParserError
    nil
  end

  def valid_score_json?(json)
    json.is_a?(Hash) && required_score_keys.all? { |key| json.key?(key) || json.key?(key.to_s) }
  end

  def required_score_keys = BaseAiAdapter::REQUIRED_SCORE_KEYS
end
