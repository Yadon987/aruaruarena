import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import App from '../App'

// ReactQueryDevtools をモックして、レンダリングされたら特定の要素を表示するようにする
// モジュール自体がインストールされていても、App.tsx で使われていなければ表示されない
vi.mock('@tanstack/react-query-devtools', () => ({
  ReactQueryDevtools: () => <div data-testid="react-query-devtools" />,
}))

describe('App Integration', () => {
  it('開発環境では ReactQueryDevtools がレンダリングされる', () => {
    // import.meta.env.DEV が true 前提の環境（Vitestデフォルト）で
    // App 内に ReactQueryDevtools があることを確認
    // 現状の App.tsx には含まれていないため失敗する
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    render(<App />)
    expect(screen.getByTestId('react-query-devtools')).toBeInTheDocument()
    process.env.NODE_ENV = originalEnv
  })

  // TODO: QueryClient設定の検証（GREEN実装後に追加）
  // - staleTime: 5分 (300,000ms)
  // - gcTime: 10分 (600,000ms)
  // - retry: ネットワークエラー時のみ1回
  // - refetchOnWindowFocus: false
  // 注: QueryClientの内部設定は直接テストしにくいため、
  //     挙動ベースのテスト（例: 同一クエリの再取得確認）で検証する
})
