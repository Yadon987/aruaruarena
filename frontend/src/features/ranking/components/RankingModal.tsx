import { type RefObject, useCallback, useEffect, useRef } from 'react'
import { RankingSection } from './RankingSection'

type RankingModalProps = {
  isOpen: boolean
  onClose: () => void
  triggerRef?: RefObject<HTMLButtonElement | null>
  myPostIds: string[]
  onSelectRankingPost: (postId: string) => void
  polling?: boolean
}

const KEY_ESCAPE = 'Escape'
const KEY_TAB = 'Tab'
const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
const DIALOG_CONTAINER_CLASS = 'w-full max-w-2xl rounded bg-white p-4'
const SCROLLABLE_SECTION_CLASS = 'max-h-[70vh] overflow-y-auto pr-2'

export function RankingModal({
  isOpen,
  onClose,
  triggerRef,
  myPostIds,
  onSelectRankingPost,
  polling,
}: RankingModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)

  const handleClose = useCallback(() => {
    onClose()
    triggerRef?.current?.focus()
  }, [onClose, triggerRef])

  const getFocusableElements = useCallback((): HTMLElement[] => {
    return Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [])
  }, [])

  const handleEscapeKey = useCallback(
    (event: globalThis.KeyboardEvent): boolean => {
      if (event.key !== KEY_ESCAPE) return false
      event.preventDefault()
      handleClose()
      return true
    },
    [handleClose]
  )

  const handleFocusTrap = useCallback(
    (event: globalThis.KeyboardEvent) => {
      if (event.key !== KEY_TAB) return

      const focusableElements = getFocusableElements()
      if (focusableElements.length === 0) return

      const first = focusableElements[0]
      const last = focusableElements[focusableElements.length - 1]
      const active = document.activeElement

      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
        return
      }

      if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    },
    [getFocusableElements]
  )

  useEffect(() => {
    if (!isOpen) return
    closeButtonRef.current?.focus()
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (handleEscapeKey(event)) return
      handleFocusTrap(event)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleEscapeKey, handleFocusTrap, isOpen])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex h-full items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="ランキングモーダルを閉じる"
        className="absolute inset-0 bg-black/50"
        data-testid="ranking-modal-overlay"
        onClick={handleClose}
      />
      <div className="relative flex h-full items-center justify-center p-4">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="ランキング"
          tabIndex={-1}
          className={DIALOG_CONTAINER_CLASS}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">ランキング</h2>
            <button ref={closeButtonRef} type="button" onClick={handleClose}>
              閉じる
            </button>
          </div>

          <div className={SCROLLABLE_SECTION_CLASS}>
            <RankingSection
              myPostIds={myPostIds}
              onSelectRankingPost={onSelectRankingPost}
              polling={polling}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
