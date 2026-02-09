import { describe, it, expect } from 'vitest'
// @ts-ignore
import { queryKeys } from '../queryKeys'

describe('queryKeys', () => {
  it('posts.all は ["posts"] を返す', () => {
    // 検証内容: 全件取得用のキーが正しいか
    expect(queryKeys.posts.all).toEqual(['posts'])
  })

  it('posts.detail(id) は ["posts", id] を返す', () => {
    // 検証内容: 詳細取得用のキーがIDを含むか
    const id = 'abc'
    expect(queryKeys.posts.detail(id)).toEqual(['posts', id])
  })

  it('posts.create() は ["posts", "create"] を返す', () => {
    // 検証内容: 作成用のキーが正しいか
    expect(queryKeys.posts.create()).toEqual(['posts', 'create'])
  })

  it('rankings.all は ["rankings"] を返す', () => {
    // 検証内容: ランキング全件取得用のキーが正しいか
    expect(queryKeys.rankings.all).toEqual(['rankings'])
  })

  it('rankings.list(limit) は ["rankings", { limit }] を返す', () => {
    // 検証内容: ランキング取得(limit指定)のキーが引数を含むか
    const limit = 10
    expect(queryKeys.rankings.list(limit)).toEqual(['rankings', { limit }])
  })

  it('rankings.list() は limit が undefined の場合でも動作する', () => {
    // 検証内容: limit省略時の挙動
    // @ts-ignore
    expect(queryKeys.rankings.list()).toEqual(['rankings', { limit: undefined }])
  })
})
