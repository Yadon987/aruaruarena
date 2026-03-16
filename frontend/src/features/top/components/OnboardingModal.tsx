import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { DURATION, SCALE } from '../../../shared/constants/animations'
import { useFocusTrap } from '../../../shared/hooks/useFocusTrap'
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion'

type OnboardingModalProps = {
  isOpen: boolean
  onClose: () => void
}

const ONBOARDING_STEPS = [
  {
    title: 'あるあるを投稿',
    description: 'ニックネームと本文を入力すると、AI審査員たちがすぐに判定を始めます。',
  },
  {
    title: '審査結果をチェック',
    description: '3人の審査コメントと点数がそろうと、順位つきの結果を確認できます。',
  },
  {
    title: '気軽に見返せる',
    description: '過去の投稿や遊び方は「その他」からいつでも見直せます。',
  },
] as const

export function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const modalRef = useRef<HTMLElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const previousActiveElementRef = useRef<HTMLElement | null>(null)
  const prefersReducedMotion = useReducedMotion()

  useFocusTrap({
    isActive: isOpen,
    containerRef: modalRef,
    onEscape: onClose,
  })

  useEffect(() => {
    if (!isOpen) return

    previousActiveElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    const rafId = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus()
    })

    return () => {
      window.cancelAnimationFrame(rafId)
      if (
        previousActiveElementRef.current &&
        document.body.contains(previousActiveElementRef.current)
      ) {
        previousActiveElementRef.current.focus()
      }
      previousActiveElementRef.current = null
    }
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[65] flex items-center justify-center p-4"
          role="presentation"
        >
          <button
            type="button"
            aria-label="遊び方ガイドを閉じる"
            className="modal-overlay-gorgeous absolute inset-0"
            onClick={onClose}
          />
          <motion.section
            ref={modalRef}
            initial={prefersReducedMotion ? {} : { opacity: 0, scale: SCALE.SHRUNK }}
            animate={prefersReducedMotion ? {} : { opacity: 1, scale: SCALE.NORMAL }}
            exit={prefersReducedMotion ? {} : { opacity: 0, scale: SCALE.SHRUNK }}
            transition={{ duration: DURATION.MODAL }}
            className="modal-gorgeous-base relative z-10 flex max-h-[calc(100dvh-6rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl p-5 text-slate-100 shadow-2xl sm:max-h-[calc(100dvh-10rem)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-title"
            aria-describedby="onboarding-description"
          >
            <div className="modal-header-gorgeous flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-200/80">
                  How To Play
                </p>
                <h2 id="onboarding-title" className="gold-text text-xl font-bold">
                  遊び方ガイド
                </h2>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                className="modal-close-gorgeous"
                aria-label="閉じる"
              >
                <span aria-hidden="true" className="leading-none text-lg">
                  ×
                </span>
              </button>
            </div>

            <div className="modal-scroll-area mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
              <p id="onboarding-description" className="text-sm leading-6 text-slate-100/90">
                まずは遊び方をチェック。
              </p>

              <ol className="mt-5 space-y-3">
                {ONBOARDING_STEPS.map((step, index) => (
                  <li
                    key={step.title}
                    className="rounded-2xl border border-white/15 bg-white/10 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.12)]"
                  >
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-300/90 text-sm font-bold text-slate-900">
                        {index + 1}
                      </span>
                      <div>
                        <h3 className="text-base font-semibold text-amber-50">{step.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-100/85">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                className="neon-button-base neon-glow-pink min-w-28"
                onClick={onClose}
                aria-label="はじめる"
              >
                はじめる
              </button>
            </div>
          </motion.section>
        </div>
      )}
    </AnimatePresence>
  )
}
