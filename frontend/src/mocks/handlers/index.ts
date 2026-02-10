/**
 * MSWハンドラー統合エクスポート
 *
 * デフォルトハンドラーとエラーハンドラーをエクスポートします。
 */
import { postsHandlers } from './posts'
import { rankingsHandlers } from './rankings'
import { errorHandlers } from './errors'

/** デフォルトハンドラー（正常系） */
export const handlers = [...postsHandlers, ...rankingsHandlers]

/** エラーハンドラー（テストで server.use() して使用） */
export { errorHandlers }

