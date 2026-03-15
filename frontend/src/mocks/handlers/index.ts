/**
 * MSWハンドラー統合エクスポート
 *
 * デフォルトハンドラーとエラーハンドラーをエクスポートします。
 */

import { healthHandlers } from './health'
import { errorHandlers } from './errors'
import { postsHandlers } from './posts'
import { rankingsHandlers } from './rankings'

/** デフォルトハンドラー（正常系） */
export const handlers = [...healthHandlers, ...postsHandlers, ...rankingsHandlers]

/** エラーハンドラー（テストで server.use() して使用） */
export { errorHandlers }
