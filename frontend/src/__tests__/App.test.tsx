import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../App'
import React from 'react'

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
    render(<App />)
    expect(screen.getByTestId('react-query-devtools')).toBeInTheDocument()
  })
})
