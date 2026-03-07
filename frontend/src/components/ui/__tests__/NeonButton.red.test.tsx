import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { loadComponent } from '../../../test/mocks/framerMotion'

const loadNeonButton = () => loadComponent(() => import('../NeonButton'))

describe('E25-01 RED: NeonButton', () => {
  it('primaryバリアントで青ネオン装飾が適用される', async () => {
    // 何を検証するか: E25-01の受け入れ基準として、primary指定時に青ネオンの見た目クラスが付与されること
    const { NeonButton } = await loadNeonButton()

    render(
      <NeonButton ariaLabel="投稿する" onClick={() => {}} variant="primary">
        投稿する
      </NeonButton>
    )

    const button = screen.getByRole('button', { name: '投稿する' })
    expect(button).toHaveClass('neon-glow-blue')
    expect(button).toHaveClass('neon-button-base')
  })

  it('type未指定時にbuttonとして扱われる', async () => {
    // 何を検証するか: E25-01の受け入れ基準として、type省略時のデフォルトがbuttonであること
    const { NeonButton } = await loadNeonButton()

    render(
      <NeonButton ariaLabel="ランキング" onClick={() => {}}>
        ランキング
      </NeonButton>
    )

    expect(screen.getByRole('button', { name: 'ランキング' })).toHaveAttribute('type', 'button')
  })

  it('disabled時はクリックイベントを発火しない', async () => {
    // 何を検証するか: E25-01の受け入れ基準として、無効化時に押下されてもonClickが呼ばれないこと
    const { NeonButton } = await loadNeonButton()
    const onClick = vi.fn()

    render(
      <NeonButton ariaLabel="プライバシーポリシー" onClick={onClick} disabled>
        プライバシーポリシー
      </NeonButton>
    )

    fireEvent.click(screen.getByRole('button', { name: 'プライバシーポリシー' }))

    expect(onClick).not.toHaveBeenCalled()
  })
})
