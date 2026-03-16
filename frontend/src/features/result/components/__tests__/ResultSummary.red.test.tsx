import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ResultSummary } from '../ResultSummary'

describe('E15-03 RED: ResultSummary', () => {
  it('タブレット帯で余白とタイポが拡張しすぎないクラス構成になっている', () => {
    // 何を検証するか: 審査結果モーダルがタブレットで大きくなりすぎないよう調整されていること
    render(
      <ResultSummary
        nickname="テスト太郎"
        body="本文です"
        status="scored"
        averageScore={88.8}
        rank={3}
        totalCount={12}
        onClose={() => {}}
      />
    )

    const summary = screen.getByRole('region', { name: '審査結果サマリー' })
    expect(summary.className).toMatch(/p-4/)
    expect(summary.className).toMatch(/lg:p-5/)

    const title = screen.getByRole('heading', { level: 2 })
    expect(title.className).toMatch(/lg:text-3xl/)

    const body = screen.getByText('「本文です」')
    expect(body.className).toMatch(/lg:text-base/)

    const stats = summary.querySelector('.result-summary-stats')
    expect(stats).not.toBeNull()
    expect(stats?.className).toMatch(/mt-4/)
    expect(stats?.className).toMatch(/lg:mt-5/)

    const actions = screen.getByTestId('result-summary-actions')
    expect(actions.className).toMatch(/mt-5/)
    expect(actions.className).toMatch(/lg:mt-6/)
    expect(actions.className).toMatch(/result-summary-actions-count-1/)
  })

  it('共有ありの審査完了時は主要導線3ボタンが表示される', () => {
    render(
      <ResultSummary
        nickname="テスト太郎"
        body="本文です"
        status="scored"
        averageScore={88.8}
        rank={3}
        totalCount={12}
        onClose={() => {}}
        showShareActions={true}
        ogpStatus="ready"
        ogpPreviewUrl="https://example.com/ogp.png"
        onShareToX={() => {}}
      />
    )

    const actions = screen.getByTestId('result-summary-actions')
    const buttons = actions.querySelectorAll('.result-summary-action-button')

    expect(actions.className).toMatch(/result-summary-actions-count-3/)
    expect(buttons).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'シェア画像を表示' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xでシェアする' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'トップへ' })).toBeInTheDocument()
  })

  it('共有準備中かつ再審査ありでは5ボタン想定のクラスが付与される', () => {
    render(
      <ResultSummary
        nickname="テスト太郎"
        body="本文です"
        status="failed"
        onClose={() => {}}
        onRejudge={() => {}}
        showShareActions={true}
        ogpStatus="pending"
        ogpPreviewUrl="https://example.com/ogp.png"
        onShareToX={() => {}}
      />
    )

    const actions = screen.getByTestId('result-summary-actions')
    const buttons = actions.querySelectorAll('.result-summary-action-button')

    expect(actions.className).toMatch(/result-summary-actions-count-5/)
    expect(buttons).toHaveLength(5)
  })
})
