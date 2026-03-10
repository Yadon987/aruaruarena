import './AudioConsentModal.css'

const CONSENT_DEFAULT_VOLUME = 0.6

export type AudioConsentModalProps = {
  isOpen: boolean
  onConsent: (volume: number) => void
}

export function AudioConsentModal({ isOpen, onConsent }: AudioConsentModalProps) {
  if (!isOpen) return null

  return (
    <div className="audio-consent-modal-backdrop" role="presentation">
      <section
        className="audio-consent-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="audio-consent-title"
      >
        <h2 id="audio-consent-title" className="audio-consent-modal__title">
          音声を再生しますか？
        </h2>
        <p className="audio-consent-modal__description">
          いつでも右上の音声ボタンから音量を調整できます。
        </p>
        <div className="audio-consent-modal__actions">
          <button type="button" className="audio-consent-modal__button" onClick={() => onConsent(0.0)}>
            いいえ
          </button>
          <button
            type="button"
            className="audio-consent-modal__button audio-consent-modal__button--primary"
            onClick={() => onConsent(CONSENT_DEFAULT_VOLUME)}
          >
            はい
          </button>
        </div>
      </section>
    </div>
  )
}
