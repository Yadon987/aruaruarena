import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { DEFAULT_VOLUME } from '../../../hooks/useSound'
import { DURATION, SCALE } from '../../../shared/constants/animations'
import { useFocusTrap } from '../../../shared/hooks/useFocusTrap'
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion'
import './AudioConsentModal.css'

export type AudioConsentModalProps = {
  isOpen: boolean
  onConsent: (volume: number) => void
}

export function AudioConsentModal({ isOpen, onConsent }: AudioConsentModalProps) {
  const modalRef = useRef<HTMLElement | null>(null)
  const rejectButtonRef = useRef<HTMLButtonElement | null>(null)
  const previousActiveElementRef = useRef<HTMLElement | null>(null)
  const prefersReducedMotion = useReducedMotion()

  useFocusTrap({
    isActive: isOpen,
    containerRef: modalRef,
    onEscape: () => {
      // 初回同意モーダルは明示選択を必須とするため、Escapeで閉じない。
    },
  })

  useEffect(() => {
    if (!isOpen) return

    previousActiveElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    const rafId = window.requestAnimationFrame(() => {
      rejectButtonRef.current?.focus()
    })

    return () => {
      window.cancelAnimationFrame(rafId)
      previousActiveElementRef.current?.focus()
      previousActiveElementRef.current = null
    }
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="audio-consent-modal-backdrop" role="presentation">
          <motion.section
            ref={modalRef}
            initial={prefersReducedMotion ? {} : { opacity: 0, scale: SCALE.SHRUNK }}
            animate={prefersReducedMotion ? {} : { opacity: 1, scale: SCALE.NORMAL }}
            exit={prefersReducedMotion ? {} : { opacity: 0, scale: SCALE.SHRUNK }}
            transition={{ duration: DURATION.MODAL }}
            className="audio-consent-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="audio-consent-title"
            aria-describedby="audio-consent-description"
          >
            <div className="audio-consent-modal__header">
              <h2 id="audio-consent-title" className="audio-consent-modal__title">
                音声を再生しますか？
              </h2>
            </div>
            <p id="audio-consent-description" className="audio-consent-modal__description">
              いつでも右上の音声ボタンから音量を調整できます。
            </p>
            <div className="audio-consent-modal__actions">
              <button
                ref={rejectButtonRef}
                type="button"
                className="audio-consent-modal__button audio-consent-modal__button--secondary"
                onClick={() => onConsent(0.0)}
              >
                いいえ
              </button>
              <button
                type="button"
                className="audio-consent-modal__button audio-consent-modal__button--primary"
                onClick={() => onConsent(DEFAULT_VOLUME)}
              >
                はい
              </button>
            </div>
          </motion.section>
        </div>
      )}
    </AnimatePresence>
  )
}
