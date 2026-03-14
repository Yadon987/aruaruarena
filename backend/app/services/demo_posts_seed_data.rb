# frozen_string_literal: true

# ダミー投稿投入に使う固定データ
module DemoPostsSeedData
  PERSONAS = %w[hiroyuki dewi nakao].freeze
  BASE_CREATED_AT = Time.zone.parse('2026-03-14 09:00:00 JST').to_i
  SCORE_PATTERNS = {
    'hiroyuki' => %i[originality brevity humor expression empathy],
    'dewi' => %i[expression humor empathy originality brevity],
    'nakao' => %i[humor empathy expression brevity originality]
  }.freeze
  COMMENT_TEMPLATES = {
    'hiroyuki' => 'その場面、想像したらちょっと笑いました',
    'dewi' => '観察が細かくて品よく面白いですわ',
    'nakao' => '情景が浮かんで余韻までちゃんとありますね'
  }.freeze
  POSTS = [
    { nickname: 'ルフィ', body: '会議前に急にやる気だけ海賊王級' },
    { nickname: '孫悟空', body: '昼休みだけ食欲が戦闘モード' },
    { nickname: 'ナルト', body: '既読つけた瞬間に返事を忘れるってばよ' },
    { nickname: '炭治郎', body: '気まずい空気でもとりあえず謝る' },
    { nickname: 'エレン', body: '締切直前だけ自由を奪われた顔になる' },
    { nickname: 'ルルーシュ', body: '完璧な計画ほど寝坊で崩れる' },
    { nickname: 'デク', body: 'メモだけ本気で行動が追いつかない' },
    { nickname: '虎杖悠仁', body: 'ノリで引き受けて後から焦る' },
    { nickname: '空条承太郎', body: '平静な顔で内心だけ大荒れ' },
    { nickname: '坂田銀時', body: 'やる日は来ると言い続けて週末終わる' },
    { nickname: '黒崎一護', body: '頼まれると結局断れずに残る' },
    { nickname: '江戸川コナン', body: '違和感だけ先に見つけて説明できない' },
    { nickname: '桜木花道', body: '根拠はないのに自信だけは満点' },
    { nickname: 'ケンシロウ', body: '静かな怒りが顔にだけ出る' },
    { nickname: '越前リョーマ', body: 'まだ本気出してない感だけうまい' },
    { nickname: '緋村剣心', body: '丸く収めたあとで一人反省会する' },
    { nickname: 'サイタマ', body: '全力出す前に用事が終わってる' },
    { nickname: '両津勘吉', body: 'ひらめきは天才、詰めで全部こぼす' },
    { nickname: '月野うさぎ', body: '朝だけ感情の起伏が魔法少女級' },
    { nickname: '木之本桜', body: '片付けたはずの机が夕方また散らかる' }
  ].freeze
end
