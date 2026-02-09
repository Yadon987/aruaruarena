export const queryKeys = {
  posts: {
    all: ['posts'] as const,
    detail: (id: string) => [...queryKeys.posts.all, id] as const,
    create: () => [...queryKeys.posts.all, 'create'] as const,
  },
  rankings: {
    all: ['rankings'] as const,
    list: (limit?: number) => [...queryKeys.rankings.all, { limit }] as const,
  },
} as const

export type QueryKeys = typeof queryKeys
