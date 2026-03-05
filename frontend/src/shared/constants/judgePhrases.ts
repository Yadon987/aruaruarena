import type { JudgePersona } from '../types/domain'

/** 各審査員の口癖配列 */
export const JUDGE_PHRASES: Record<JudgePersona, readonly string[]> = {
  hiroyuki: [
    'なんか、そういうデータあるんですか？',
    '嘘つくのやめてもらっていいですか？',
    'なんだろう……',
    '無理じゃないですか？',
    '頭の悪い人には分からないかもしれないですけど',
    'それってあなたの感想ですよね',
    '僕はさっきから、事実の話をしてるんですよ',
    'はい、論破',
  ],
  dewi: [
    'わたくし、嘘は大嫌いですの',
    '何ですって！？',
    'あら、素敵じゃない',
    '本物を見極める力が必要なんですのよ',
    'そんなこと、わたくしには通用いたしませんざます',
    'わたくしの社交界では……',
    'お里が知れますわよ',
    'オ〜ッホッホッホ！',
    'フンッ',
    'まあ……',
  ],
  nakao: [
    'なんだよ...',
    'ふむ...',
    '悪くないね',
    'ほう...',
    '粋だねぇ',
    '野暮だよ',
    '本物だね',
    'なんだい？',
    'いいじゃない',
    'なかなか良いじゃねぇか',
    '理屈じゃないんだよ',
    'お前さぁ……',
    'やめなよ',
    'ふんっ',
  ],
} as const

/** 審査員IDの配列 */
export const JUDGES: readonly JudgePersona[] = Object.keys(
  JUDGE_PHRASES
) as unknown as readonly JudgePersona[]
