// aruaruarena データベース設計（DynamoDBをER風に表現）

Project aruaruarena {
  database_type: 'DynamoDB'
  Note: '''
  DynamoDB (NoSQL), オンデマンドモード
  [制約事項]
  - posts: 永久保存 (updated_at は意図的に除外)
  - judges_count: 最大3人 (3人完了で scored)
  - rate_limits, duplicate_checks: TTLにより自動削除
  '''
}

Table posts {
  // Partition Key
  id            string        [pk, note: 'UUID']
  
  // Attributes
  nickname      string        [not null, note: '1-20文字（表示は8文字超で省略）']
  body          string        [not null, note: '3-30文字（grapheme単位で厳密カウント）']
  status        string        [not null, note: 'judging / scored / failed (App default: judging, scored時はGSI PKに使用)']
  
  // Scoring
  average_score number        [note: '平均点 (小数第1位: Decimal/Float) 例: 87.3']
  judges_count  number        [not null, note: '成功した審査員数 (0-3の整数, App default: 0)']

  // GSI: RankingIndex (TOP50取得用)
  score_key     string        [note: 'GSI Sort Key (status=scoredのみ設定, 他はNULL)']

  // Timestamps
  created_at    number        [not null, note: 'UnixTimestamp (seconds/整数)']

  indexes {
    (status, score_key) [name: 'RankingIndex', note: 'status=scored でTOP50取得 (スパースインデックス)']
  }

  Note: '''
  score_key の構成（ランクが高い順かつ同点は早い順）:
  inv_score = 1000 - (average_score * 10)
  score_key = format("%04d#%010d#%s", inv_score, created_at, id)
  '''
}

Table judgements {
  // Primary Key (上書き型: 再審査時は同じpersonaで上書き)
  post_id       string        [not null, note: 'Partition Key']
  persona       string        [not null, note: 'Sort Key: hiroyuki / dewi / nakao']

  // Attributes
  id            string        [not null, note: 'UUID (ログ・デバッグ用)']
  succeeded     boolean       [not null, note: 'API成功/失敗 (App default: false)']
  error_code    string        [note: '失敗時: timeout / provider_error など']

  // Scores (失敗時はNULL)
  empathy       number        [note: '共感度 (0-20の整数)']
  humor         number        [note: '面白さ (0-20の整数)']
  brevity       number        [note: '簡潔さ (0-20の整数)']
  originality   number        [note: '独創性 (0-20の整数)']
  expression    number        [note: '表現力 (0-20の整数)']
  total_score   number        [note: '合計点 (0-100の整数)']
  comment       string        [note: '審査コメント']

  // Timestamps
  judged_at     number        [not null, note: '最終審査日時 (UnixTimestamp/整数)']

  indexes {
    (post_id, persona) [pk, name: 'PrimaryKey']
  }

  Note: '再審査時は上書き保存。過去の履歴はCloudWatch Logsで管理。'
}

Table rate_limits {
  identifier    string        [pk, note: 'PK: ip#hash または nick#hash']
  expires_at    number        [not null, note: 'TTL (UnixTimestamp/整数, 5分後自動削除)']
}

Table duplicate_checks {
  body_hash     string        [pk, note: 'PK: 正規化後ハッシュ']
  post_id       string        [note: '最初に登録された投稿ID（トレース用）']
  expires_at    number        [not null, note: 'TTL (UnixTimestamp/整数, 24時間後自動削除)']
}

Ref: judgements.post_id > posts.id
Ref: duplicate_checks.post_id > posts.id
