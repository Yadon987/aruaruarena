import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import App from '../../../App'

vi.mock('@tanstack/react-query-devtools', () => ({
  ReactQueryDevtools: () => <div data-testid="react-query-devtools" />,
}))

describe('TopPage Ranking Integration RED', () => {
  it('初回表示でローディング後にランキング一覧が表示される', async () => {
    // 何を検証するか: 初回取得でloadingからランキング表示へ遷移すること
    render(<App />)

    expect(await screen.findByRole('region', { name: 'ランキング表示エリア' })).toBeInTheDocument()
    expect(screen.getAllByTestId('ranking-item')).toHaveLength(20)
  })

  it('429エラー時に専用メッセージを表示する', async () => {
    // 何を検証するか: レート制限時に専用エラーメッセージを表示すること
    render(<App />)

    expect(
      await screen.findByText('アクセスが集中しています。しばらく待ってから再度お試しください。')
    ).toBeInTheDocument()
  })
})
