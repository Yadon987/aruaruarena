import { motion } from 'framer-motion'
import { type RefObject, useCallback, useEffect, useRef } from 'react'
import { DURATION, SCALE } from '../../../shared/constants/animations'
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion'
import { PRIVACY_POLICY_TEXT, TERMS_TEXT } from '../constants/privacyPolicy'

type Props = {
  isOpen: boolean
  onClose: () => void
  triggerRef?: RefObject<HTMLButtonElement | null>
}

const KEY_ESCAPE = 'Escape'
const KEY_TAB = 'Tab'
const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
const DIALOG_CONTAINER_CLASS = 'modal-gorgeous-base w-full max-w-2xl rounded-2xl p-4 text-slate-100'
const SCROLL_AREA_CLASS = 'modal-scroll-area max-h-[60vh] overflow-y-auto space-y-6 pr-2'

export function PrivacyPolicyModal({ isOpen, onClose, triggerRef }: Props) {
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

      // Shift+Tab / Tab で先頭・末尾を跨ぐときに循環させ、モーダル外へフォーカスが抜けるのを防ぐ。
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
      role="presentation"
    >
      <button
        type="button"
        aria-label="プライバシーポリシーモーダルを閉じる"
        className="modal-overlay-gorgeous absolute inset-0"
        data-testid="privacy-policy-modal-overlay"
        onClick={handleClose}
      />
      <div className="relative flex h-full items-center justify-center p-4">
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, scale: SCALE.SHRUNK }}
          animate={prefersReducedMotion ? {} : { opacity: 1, scale: SCALE.NORMAL }}
          transition={{ duration: DURATION.MODAL }}
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="プライバシーポリシー"
          tabIndex={-1}
          className={DIALOG_CONTAINER_CLASS}
        >
          <div className="modal-header-gorgeous flex items-center justify-between gap-4">
            <h2 className="gold-text text-lg font-semibold">プライバシーポリシー</h2>
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

          <div data-testid="privacy-policy-scroll-area" className={SCROLL_AREA_CLASS}>
            <section>
              <h3 className="mb-2 font-semibold text-amber-100">利用規約</h3>
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-100/90">
                {TERMS_TEXT}
              </p>
            </section>

            <section>
              <h3 className="mb-2 font-semibold text-amber-100">プライバシーポリシー</h3>
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-100/90">
                {PRIVACY_POLICY_TEXT}
              </p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
