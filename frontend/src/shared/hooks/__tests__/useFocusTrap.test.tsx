import { fireEvent, render, screen } from '@testing-library/react'
import { useRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useFocusTrap } from '../useFocusTrap'

function FocusTrapTestModal({ isActive, onEscape }: { isActive: boolean; onEscape: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null)
  useFocusTrap({ isActive, containerRef: ref, onEscape })
  const [value, setValue] = useState('')

  return (
    <div ref={ref} role="dialog" aria-label="テストモーダル">
      <button type="button">最初</button>
      <input aria-label="入力" value={value} onChange={(e) => setValue(e.target.value)} />
      <button type="button">最後</button>
    </div>
  )
}

describe('useFocusTrap', () => {
  it('isActive=false のとき Escape を押しても onEscape を呼ばない', () => {
    const onEscape = vi.fn()
    render(<FocusTrapTestModal isActive={false} onEscape={onEscape} />)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onEscape).not.toHaveBeenCalled()
  })

  it('Escape キーで onEscape が呼ばれる', () => {
    const onEscape = vi.fn()
    render(<FocusTrapTestModal isActive={true} onEscape={onEscape} />)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onEscape).toHaveBeenCalledTimes(1)
  })

  it('Tab で最後の要素から最初の要素へ循環する', () => {
    const onEscape = vi.fn()
    render(<FocusTrapTestModal isActive={true} onEscape={onEscape} />)

    const first = screen.getByRole('button', { name: '最初' })
    const last = screen.getByRole('button', { name: '最後' })
    last.focus()
    fireEvent.keyDown(document, { key: 'Tab' })

    expect(document.activeElement).toBe(first)
  })

  it('Shift+Tab で最初の要素から最後の要素へ循環する', () => {
    const onEscape = vi.fn()
    render(<FocusTrapTestModal isActive={true} onEscape={onEscape} />)

    const first = screen.getByRole('button', { name: '最初' })
    const last = screen.getByRole('button', { name: '最後' })
    first.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })

    expect(document.activeElement).toBe(last)
  })

  it('モーダル外にフォーカスが移った場合、Tabキーでモーダル内にフォーカスを戻す', () => {
    const onEscape = vi.fn()
    render(<FocusTrapTestModal isActive={true} onEscape={onEscape} />)

    const first = screen.getByRole('button', { name: '最初' })
    const externalButton = document.createElement('button')
    document.body.appendChild(externalButton)
    externalButton.focus()

    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(first)

    document.body.removeChild(externalButton)
  })
})
