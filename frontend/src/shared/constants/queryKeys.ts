/**
 * TanStack Queryのクエリキー定義
 * キャッシュの無効化や再取得に使用
 */
export const queryKeys = {
  posts: {
    /** 全投稿のキー */
    all: ['posts'] as const,
    /** 投稿詳細のキー（IDで識別） */
    detail: (id: string) => [...queryKeys.posts.all, id] as const,
    /** 投稿作成のキー */
    create: () => [...queryKeys.posts.all, 'create'] as const,
  },
  rankings: {
    /** 全ランキングのキー */
    all: ['rankings'] as const,
    /** ランキング一覧のキー（limitで件数指定） */
    list: (limit?: number) => [...queryKeys.rankings.all, { limit }] as const,
  },
} as const

export type QueryKeys = typeof queryKeys
