import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { trackTopPageView } from '../shared/services/analytics'

// ReactQueryDevtools をモックして、レンダリングされたら特定の要素を表示するようにする
// モジュール自体がインストールされていても、App.tsx で使われていなければ表示されない
vi.mock('@tanstack/react-query-devtools', () => ({
  ReactQueryDevtools: () => <div data-testid="react-query-devtools" />,
}))

vi.mock('../shared/services/analytics', () => ({
  trackTopPageView: vi.fn(),
}))

describe('App Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('開発環境では ReactQueryDevtools がレンダリングされる', () => {
    // Vitest runs in development mode by default (import.meta.env.DEV === true)
    // so no environment manipulation is needed
    render(<App />)
    expect(screen.getByTestId('react-query-devtools')).toBeInTheDocument()
  })

  it('Viteのデフォルトコンテンツが表示されない', () => {
    render(<App />)
    expect(screen.queryByText(/Vite \+ React/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/count is/i)).not.toBeInTheDocument()
  })

  it('トップ画面の初回表示時にGA4のpage_view送信を呼び出す', () => {
    render(<App />)

    expect(trackTopPageView).toHaveBeenCalledTimes(1)
  })

  // TODO: QueryClient設定の検証（GREEN実装後に追加）
  // - staleTime: 5分 (300,000ms)
  // - gcTime: 10分 (600,000ms)
  // - retry: ネットワークエラー時のみ1回
  // - refetchOnWindowFocus: false
  // 注: QueryClientの内部設定は直接テストしにくいため、
  //     挙動ベースのテスト（例: 同一クエリの再取得確認）で検証する
})
