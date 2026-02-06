// aruaruarena データベース設計（DynamoDBをER風に表現）

Project aruaruarena {
  database_type: 'DynamoDB'
  Note: 'DynamoDB (NoSQL), オンデマンドモード, submissions は永久保存, rate_limits / content_dedup はTTLで自動削除'
}

Table submissions {
  submission_id varchar [pk, note: 'UUID, Partition Key']
  nickname varchar(20) [not null, note: '1-20文字（表示は8文字超で省略）']
  content varchar(30) [not null, note: '3-30文字（grapheme単位で厳密カウント）']
  content_norm_hash varchar [not null, note: '正規化後ハッシュ（重複検出の追跡用）']
  rate_limit_key varchar [not null, note: 'ip#hash または nick#hash（投稿時のレート制限キー）']
  average_score decimal(4,1) [note: '平均点（小数第1位）例: 87.3']
  judged_count int [note: '成功した審査員数（0-3）']
  status varchar [not null, default: 'judging', note: 'judging / scored / failed']
  created_at bigint [not null, note: 'UnixTimestamp (seconds)']
  updated_at bigint [not null, note: 'UnixTimestamp (seconds)']
  ranking_pk varchar [not null, default: 'general', note: 'GSI用の固定Partition Key']
  rank_key varchar [note: 'GSI Sort Key（採点確定後にセット）']

  indexes {
    (ranking_pk, rank_key) [name: 'RankingIndex', note: 'GSI: TOP50取得・順位COUNT用']
  }
}

Table judgements {
  submission_id varchar [not null, note: 'Partition Key（投稿ID）']
  judge_sort varchar [not null, note: 'Sort Key: judge_name#created_at#judgement_id']
  judgement_id varchar [not null, note: 'UUID']
  judge_name varchar [not null, note: 'hiroyuki / dewi / nakao']
  created_at bigint [not null, note: 'UnixTimestamp (seconds)']
  success boolean [not null, default: true, note: 'API成功/失敗']
  empathy int [note: '共感度 0-20点']
  humor int [note: '面白さ 0-20点']
  brevity int [note: '簡潔さ 0-20点']
  originality int [note: '独創性 0-20点']
  expression int [note: '表現力 0-20点']
  total_score int [note: '合計点 0-100点']
  comment text [note: '審査コメント']
  catchphrase varchar [note: '口癖セリフ']
  error_code varchar [note: 'timeout / provider_error など（失敗時）']

  indexes {
    (submission_id, judge_sort) [pk, name: 'PrimaryKey']
  }
}

Table rate_limits {
  key varchar [pk, note: 'ip#hash または nick#hash']
  last_posted_at bigint [not null, note: 'UnixTimestamp (seconds)']
  expires_at bigint [not null, note: 'TTL（5分後）自動削除']
}

Table content_dedup {
  content_norm_hash varchar [pk, note: 'Partition Key（正規化後ハッシュ）']
  created_at bigint [not null, note: 'UnixTimestamp (seconds)']
  expires_at bigint [not null, note: 'TTL（24時間後）自動削除']
  submission_id varchar [note: '最初に登録された投稿ID（トレース用）']
}

Ref: judgements.submission_id > submissions.submission_id
Ref: content_dedup.submission_id > submissions.submission_id
Ref: submissions.rate_limit_key > rate_limits.key
