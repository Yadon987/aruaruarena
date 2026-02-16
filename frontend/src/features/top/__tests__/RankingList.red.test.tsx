import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import App from '../../../App'

vi.mock('@tanstack/react-query-devtools', () => ({
  ReactQueryDevtools: () => <div data-testid="react-query-devtools" />,
}))

describe('RankingList RED', () => {
  it('トップ画面にランキング領域が表示される', () => {
    // 何を検証するか: ランキング表示エリアがトップ画面に存在すること
    render(<App />)

    expect(screen.getByRole('region', { name: 'ランキング表示エリア' })).toBeInTheDocument()
  })

  it('ランキングが20件表示される', () => {
    // 何を検証するか: TOP20ランキングが一覧表示されること
    render(<App />)

    const rankingItems = screen.getAllByTestId('ranking-item')
    expect(rankingItems).toHaveLength(20)
  })
})
