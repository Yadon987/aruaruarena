/**
 * 文字列をユーザー視点（grapheme clusters）で数える。
 * String#length や UTF-16 文字数と異なり、絵文字・結合文字を1文字扱いする。
 *
 * @remarks
 * Intl.Segmenter 未対応環境ではフォールバックとして `[...value]` を用いるため
 * 合成絵文字（例: 👨‍👩‍👧‍👦）は複数文字として数えられる場合があります。
 */
export function countGraphemeClusters(value: string): number {
  type IntlSegmenter = {
    new (
      locales: string | string[] | undefined,
      options: { granularity: 'grapheme' }
    ): {
      segment: (text: string) => Iterable<unknown>
    }
  }

  const IntlWithSegmenter = Intl as typeof Intl & { Segmenter?: IntlSegmenter }
  const Segmenter = IntlWithSegmenter.Segmenter

  if (typeof Segmenter === 'function') {
    const segmenter = new Segmenter(undefined, { granularity: 'grapheme' })
    return Array.from(segmenter.segment(value)).length
  }

  return [...value].length
}
