import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../../../App'
import { openPostDialog } from '../../../test/helpers'

describe('E12-01 RED: TopPage レイアウト', () => {
  it('トップ画面に主要セクション・投稿ボタンが表示される', () => {
    // 何を検証するか: 右上操作領域・投稿ボタン・補助導線が初期表示されること
    render(<App />)

    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
    expect(screen.getByTestId('top-action-controls')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '投稿する' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ランキング' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'その他を開く' })).toBeInTheDocument()
  })

  it('投稿するボタン押下で投稿フォームの必須入力UIを表示する', async () => {
    // 何を検証するか: 投稿するボタン押下でニックネーム・本文・投稿ボタンが表示されること
    render(<App />)
    await openPostDialog()

    expect(screen.getByLabelText('ニックネーム')).toBeInTheDocument()
    expect(screen.getByLabelText('あるある')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '投稿' })).toBeInTheDocument()
  })
})
