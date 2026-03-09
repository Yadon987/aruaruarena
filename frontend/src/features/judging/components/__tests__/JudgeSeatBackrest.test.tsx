import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { JudgeSeatBackrest } from '../JudgeSeatBackrest'

describe('JudgeSeatBackrest', () => {
  it('variant未指定時はクラウン型を表示する', () => {
    const { container } = render(<JudgeSeatBackrest />)

    expect(container.querySelector('.judge-seat-backrest-crown')).toBeInTheDocument()
    expect(container.querySelector('.judge-seat-backrest-tufted')).not.toBeInTheDocument()
    expect(container.querySelector('.judge-seat-backrest-marquee')).not.toBeInTheDocument()
  })

  it('キルティング型を表示できる', () => {
    const { container } = render(<JudgeSeatBackrest variant="royal-tufted" />)

    expect(container.querySelector('.judge-seat-backrest-tufted')).toBeInTheDocument()
  })

  it('マーキー型を表示できる', () => {
    const { container } = render(<JudgeSeatBackrest variant="royal-marquee" />)

    expect(container.querySelector('.judge-seat-backrest-marquee')).toBeInTheDocument()
    expect(container.querySelectorAll('.judge-seat-backrest-bulb').length).toBeGreaterThan(12)
  })
})
