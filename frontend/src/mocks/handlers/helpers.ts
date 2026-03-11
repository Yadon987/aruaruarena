/**
 * MSWハンドラー用ヘルパー関数
 *
 * モックデータ生成や共通処理を提供します。
 */
import { MOCK, RANKING } from './constants'

/**
 * モック投稿データの型
 */
interface MockPost {
  id: string
  nickname: string
  body: string
  status: 'judging' | 'scored' | 'failed'
  average_score?: number
  created_at: string
}

/**
 * モック投稿データを生成する
 *
 * @param overrides - オーバーライドするプロパティ
 * @returns モック投稿データ
 */
export function createMockPost(overrides?: Partial<MockPost>) {
  return {
    id: MOCK.UUID_PREFIX + Date.now(),
    nickname: MOCK.DEFAULT_NICKNAME,
    body: MOCK.DEFAULT_BODY,
    status: 'judging' as const,
    created_at: MOCK.TIMESTAMP,
    ...overrides,
  }
}

/**
 * モックランキングデータを生成する
 *
 * @param count - ランキング件数
 * @returns モックランキングデータ
 */
export function createMockRankings(count: number = RANKING.DEFAULT_COUNT) {
  const rankingSamples = [
    '帰宅電車で座れる席が空いたら、周りと席取りバトルしないで「どうぞ」と言える優しさがほしい。',
    'コンビニのポイントをためすぎてレジで合計金額を間違えると財布が悲鳴を上げる。',
    'リモコンを探すたびにいつも別の部屋にあるのは、我が家の謎の黒歴史。',
    '雨の日に傘を持って出て、気づくと晴れていて荷物を洗いに行く羽目になる。',
    '会議で「とても良い視点です」を言うと、すぐ次の人に話をふられる。',
    'お弁当を温めるついでにスマホを見て、レンチンタイムに寝落ちしないか戦う。',
    'スマホの電池が1%になると、人生の価値観が「早く充電させる」一点集中する。',
    '「あと5分で出る」が実は「1時間後」に化けるのは、やる気のないアラーム音。',
    '深夜の帰宅でコンビニの自動販売機が開けると思ったら、ただの景品ゲームだった。',
    'エレベーターで誰かを見ているとき、目的階のボタンを押してしまう罪悪感。',
    '冷蔵庫の中で期限切れを発見するたびに、料理は気分で成立していると気付く。',
    '洗濯物をたたむついでに、次の日の服が減っている謎を解く脳トレ。',
    '上司に「急ぎます」と言ったら、実は自分のPCの起動待ちだけが遅かった。',
    'コンビニの新作スイーツより、先にレジの待ち時間を味わう儀式が始まる。',
    '会議の議事録で、話していない自分の意見だけ正確に引用される。',
    'コンセント探しで寝転ぶほど探ると、意外と電源タップは近い。',
    '毎朝靴を履く前に靴紐を結べたら、既に人生1勝。',
    'スマートホームの音声操作が「はい」を聞き漏らして、電気を消し忘れる。',
    '買い物袋を持ってない日は、何かとエコバッグを探してる自分に気づく。',
    '階段を上がるたびに一段低く見積もる、エレベーター依存症の性。',
    '休日の予定を立てると、気温と気力が同時に急降下する。',
    '深夜の洗濯機の音で起きたとき、実はもう明日の予定を夢見ていた。',
    '「あと少し」で閉まる通知に、またしても付き合う夜更かし。',
    'コンビニの店内広告を見て、今夜の夕食を急に決めてしまう。',
    '忘れ物を減らそうとメモに書くほど、メモだけは確実に家に忘れる。',
  ]

  const rankingNicknames = [
    'たなかさん',
    'なかじま',
    'みゆき',
    'ハナ',
    'よしき',
    'もも',
    'しん',
    'ゆうき',
    'あやね',
    'けんご',
    'りょーた',
    'さやか',
    'こいけ',
    'もりや',
    'いちご太郎',
    'ほのか',
    'あきら',
    'るい',
    'じゅん',
    'マサル',
    'しおん',
    'たっつ',
    'みお',
    'よった',
    'ふみ',
  ]

  const makeScore = (index: number) => {
    const fallback = Math.max(95 - index * 1.3, 78)
    return RANKING.SCORES[index] ?? Number(fallback.toFixed(1))
  }

  return {
    rankings: Array.from({ length: count }, (_, i) => ({
      rank: i + 1,
      id: String(i + 1),
      nickname: rankingNicknames[i] ?? `user${i + 1}`,
      body: rankingSamples[i] ?? `身近な場面で感じたことを、うまく言葉にして投稿しました。`,
      average_score: makeScore(i),
    })),
    total_count: count,
  }
}
