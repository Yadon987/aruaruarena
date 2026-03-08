import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { loadComponent } from '../../../test/mocks/framerMotion'

const loadBackgroundTitle = () => loadComponent(() => import('../BackgroundTitle'))

describe('E25-01 RED: BackgroundTitle', () => {
  it('背景装飾を表示し「あるあるアリーナ」文字は表示しない', async () => {
    // 何を検証するか: E25-01の受け入れ基準として、背景タイトル装飾が表示され、固定テキストは含まれないこと
    const { BackgroundTitle } = await loadBackgroundTitle()

    render(<BackgroundTitle />)

    const title = screen.getByTestId('background-title')

    expect(screen.queryByText('あるあるアリーナ')).not.toBeInTheDocument()
    expect(title).toBeInTheDocument()
    expect(title).toHaveClass('background-title-art')
    expect(title).toHaveClass('pointer-events-none')
  })
})
