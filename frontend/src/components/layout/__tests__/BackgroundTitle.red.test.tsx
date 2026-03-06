import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { loadComponent } from '../../../test/mocks/framerMotion'

const loadBackgroundTitle = () => loadComponent(() => import('../BackgroundTitle'))

describe('E25-01 RED: BackgroundTitle', () => {
  it('背景として「あるあるアリーナ」タイトルを表示する', async () => {
    // 何を検証するか: E25-01の受け入れ基準として、背景タイトルコンポーネントが固定テキストを表示すること
    const { BackgroundTitle } = await loadBackgroundTitle()

    render(<BackgroundTitle />)

    expect(screen.getByText('あるあるアリーナ')).toBeInTheDocument()
    expect(screen.getByTestId('background-title')).toBeInTheDocument()
  })
})
