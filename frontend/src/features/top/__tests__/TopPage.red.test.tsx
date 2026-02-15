import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from '../../../App'

describe('E12-01 RED: TopPage レイアウト', () => {
  it('トップ画面に主要4セクションを表示する', () => {
    // 何を検証するか: ヘッダー・投稿フォーム・ランキング領域・フッターが初期表示されること
    render(<App />)

    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('form', { name: '投稿フォーム' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'ランキング表示エリア' })).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })

  it('投稿フォームの必須入力UIを表示する', () => {
    // 何を検証するか: ニックネーム入力・本文入力・投稿ボタンが表示されること
    render(<App />)

    expect(screen.getByLabelText('ニックネーム')).toBeInTheDocument()
    expect(screen.getByLabelText('あるある本文')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '投稿する' })).toBeInTheDocument()
  })
})
