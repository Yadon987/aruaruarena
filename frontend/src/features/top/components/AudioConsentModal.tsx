import { useEffect, useRef } from 'react'
import { DEFAULT_VOLUME } from '../../../hooks/useSound'
import { useFocusTrap } from '../../../shared/hooks/useFocusTrap'
import './AudioConsentModal.css'

export type AudioConsentModalProps = {
  isOpen: boolean
  onConsent: (volume: number) => void
}

export function AudioConsentModal({ isOpen, onConsent }: AudioConsentModalProps) {
  const modalRef = useRef<HTMLElement | null>(null)
  const rejectButtonRef = useRef<HTMLButtonElement | null>(null)
  const previousActiveElementRef = useRef<HTMLElement | null>(null)

  useFocusTrap({
    isActive: isOpen,
    containerRef: modalRef,
    onEscape: () => {
      // 初回同意モーダルは明示選択を必須とするため、Escapeで閉じない。
    },
  })

  useEffect(() => {
    if (!isOpen) return

    previousActiveElementRef.current = document.activeElement as HTMLElement
    const rafId = window.requestAnimationFrame(() => {
      rejectButtonRef.current?.focus()
    })

    return () => {
      window.cancelAnimationFrame(rafId)
      previousActiveElementRef.current?.focus()
      previousActiveElementRef.current = null
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="audio-consent-modal-backdrop" role="presentation">
      <section
        ref={modalRef}
        className="audio-consent-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="audio-consent-title"
        aria-describedby="audio-consent-description"
      >
        <h2 id="audio-consent-title" className="audio-consent-modal__title">
          音声を再生しますか？
        </h2>
        <p id="audio-consent-description" className="audio-consent-modal__description">
          いつでも右上の音声ボタンから音量を調整できます。
        </p>
        <div className="audio-consent-modal__actions">
          <button
            ref={rejectButtonRef}
            type="button"
            className="audio-consent-modal__button"
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
      </section>
    </div>
  )
}
