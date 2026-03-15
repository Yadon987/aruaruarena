import { motion } from 'framer-motion'
import { type RefObject, useCallback, useEffect, useRef } from 'react'
import { DURATION, SCALE } from '../../../shared/constants/animations'
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion'
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
const DIALOG_CONTAINER_CLASS =
  'modal-gorgeous-base flex max-h-[calc(100dvh-10rem)] w-full max-w-[95vw] flex-col overflow-hidden rounded-2xl p-4 text-slate-100 sm:max-h-[calc(100dvh-12rem)] sm:max-w-2xl lg:max-w-3xl'
const SCROLLABLE_SECTION_CLASS = 'modal-scroll-area min-h-0 flex-1 overflow-y-auto pr-2'

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
  const prefersReducedMotion = useReducedMotion()

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
    <div className="fixed inset-0 z-50 flex h-full items-start justify-center px-4 pb-4 pt-20 sm:px-6 sm:pb-6 sm:pt-24 lg:items-center lg:py-8">
      <button
        type="button"
        aria-label="ランキングモーダルを閉じる"
        className="modal-overlay-gorgeous absolute inset-0"
        data-testid="ranking-modal-overlay"
        onClick={handleClose}
      />
      <div
        className="relative flex h-full w-full items-start justify-center lg:items-center"
        onClick={handleClose}
      >
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, scale: SCALE.SHRUNK }}
          animate={prefersReducedMotion ? {} : { opacity: 1, scale: SCALE.NORMAL }}
          transition={{ duration: DURATION.MODAL }}
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="ランキング"
          tabIndex={-1}
          className={DIALOG_CONTAINER_CLASS}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="modal-header-gorgeous flex items-center justify-between gap-4">
            <h2 className="gold-text text-lg font-semibold">ランキング</h2>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={handleClose}
              className="modal-close-gorgeous"
              aria-label="閉じる"
            >
              <span aria-hidden="true" className="leading-none text-lg">
                ×
              </span>
              <span className="sr-only">閉じる</span>
            </button>
          </div>

          <div className={SCROLLABLE_SECTION_CLASS}>
            <RankingSection
              myPostIds={myPostIds}
              onSelectRankingPost={onSelectRankingPost}
              polling={polling}
            />
          </div>
        </motion.div>
      </div>
    </div>
  )
}
