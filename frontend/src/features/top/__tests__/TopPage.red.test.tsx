import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../../../App'

describe('E12-01 RED: TopPage レイアウト', () => {
  it('トップ画面に主要セクション・投稿ボタンが表示される', () => {
    // 何を検証するか: ヘッダー・投稿ボタン・ランキング領域・フッターが初期表示されること
    render(<App />)

    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '投稿する' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'ランキング表示エリア' })).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })

  it('投稿するボタン押下で投稿フォームの必須入力UIを表示する', async () => {
    // 何を検証するか: 投稿するボタン押下でニックネーム・本文・投稿ボタンが表示されること
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '投稿する' }))
    await waitFor(() => screen.getByRole('dialog'))

    expect(screen.getByLabelText('ニックネーム')).toBeInTheDocument()
    expect(screen.getByLabelText('あるある')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '投稿' })).toBeInTheDocument()
  })
})
