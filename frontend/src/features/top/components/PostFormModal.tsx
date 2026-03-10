import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { DURATION, SCALE } from '../../../shared/constants/animations'
import { TEXT_LENGTH } from '../../../shared/constants/validation'
import { useFocusTrap } from '../../../shared/hooks/useFocusTrap'
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion'
import { countGraphemeClusters } from '../../../shared/utils'

interface PostFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: { nickname: string; body: string }) => Promise<void>
  isLoading: boolean
  error?: string
  initialNickname?: string
  initialBody?: string
  onCloseWithDraft?: (draft: { nickname: string; body: string }) => void
}

type ValidationErrors = {
  nicknameError: string
  bodyError: string
}

const MESSAGE_NICKNAME_REQUIRED = 'ニックネームを入力してください'
const MESSAGE_NICKNAME_LENGTH = `ニックネームは${TEXT_LENGTH.NICKNAME_MIN}〜${TEXT_LENGTH.NICKNAME_MAX}文字で入力してください`
const MESSAGE_BODY_LENGTH = `本文は${TEXT_LENGTH.BODY_MIN}〜${TEXT_LENGTH.BODY_MAX}文字で入力してください`
const MESSAGE_BODY_REQUIRED = '本文を入力してください'
const EMPTY_VALIDATION_ERRORS: ValidationErrors = { nicknameError: '', bodyError: '' }

/**
 * 投稿フォームモーダル
 */
export function PostFormModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  error,
  initialNickname,
  initialBody,
  onCloseWithDraft,
}: PostFormModalProps) {
  const FALLBACK_FORM_VALUE = ''
  const [nickname, setNickname] = useState('')
  const [body, setBody] = useState('')
  const [validationErrors, setValidationErrors] =
    useState<ValidationErrors>(EMPTY_VALIDATION_ERRORS)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const previousActiveElementRef = useRef<HTMLElement | null>(null)
  const submittingRef = useRef(false)
  const wasOpenRef = useRef(false)
  const prefersReducedMotion = useReducedMotion()

  useFocusTrap({
    isActive: isOpen,
    containerRef: dialogRef,
    onEscape: onClose,
  })

  useEffect(() => {
    if (isOpen) {
      // モーダルが開いた瞬間だけ初期値を反映し、入力中の内容上書きを防ぐ。
      if (!wasOpenRef.current) {
        const nextNickname = initialNickname ?? FALLBACK_FORM_VALUE
        const nextBody = initialBody ?? FALLBACK_FORM_VALUE
        setNickname(nextNickname)
        setBody(nextBody)
        setValidationErrors(EMPTY_VALIDATION_ERRORS)
        previousActiveElementRef.current = document.activeElement as HTMLElement
        closeButtonRef.current?.focus()
        wasOpenRef.current = true
      }
      return
    }

    // 閉じる操作では入力内容を下書きとして親へ通知し、再表示時に復元できるようにする。
    if (wasOpenRef.current && onCloseWithDraft && (nickname.trim() || body.trim())) {
      onCloseWithDraft({ nickname, body })
    }
    // モーダルを閉じたら元のフォーカス先へ戻し、アクセスビリティ導線を維持する。
    previousActiveElementRef.current?.focus()
    previousActiveElementRef.current = null
    setValidationErrors(EMPTY_VALIDATION_ERRORS)
    wasOpenRef.current = false
  }, [body, initialBody, initialNickname, isOpen, nickname, onCloseWithDraft])

  const buildValidationErrors = (nextNickname: string, nextBody: string): ValidationErrors => {
    const trimmedNickname = nextNickname.trim()
    const trimmedBody = nextBody.trim()
    const nicknameLength = countGraphemeClusters(trimmedNickname)
    const bodyLength = countGraphemeClusters(trimmedBody)

    const nicknameError =
      trimmedNickname.length === 0
        ? MESSAGE_NICKNAME_REQUIRED
        : nicknameLength < TEXT_LENGTH.NICKNAME_MIN || nicknameLength > TEXT_LENGTH.NICKNAME_MAX
          ? MESSAGE_NICKNAME_LENGTH
          : ''

    const bodyError =
      trimmedBody.length === 0
        ? MESSAGE_BODY_REQUIRED
        : bodyLength < TEXT_LENGTH.BODY_MIN || bodyLength > TEXT_LENGTH.BODY_MAX
          ? MESSAGE_BODY_LENGTH
          : ''

    return { nicknameError, bodyError }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isLoading || submittingRef.current) return

    const nextValidationErrors = buildValidationErrors(nickname, body)
    if (nextValidationErrors.nicknameError || nextValidationErrors.bodyError) {
      setValidationErrors(nextValidationErrors)
      return
    }

    submittingRef.current = true
    try {
      await onSubmit({ nickname, body })
    } finally {
      submittingRef.current = false
    }
  }

  const handleBackdropClick = () => {
    onClose()
  }

  const handleNicknameChange = (value: string) => {
    setNickname(value)
    setValidationErrors(buildValidationErrors(value, body))
  }

  const handleBodyChange = (value: string) => {
    setBody(value)
    setValidationErrors(buildValidationErrors(nickname, value))
  }

  const alertMessages = [
    { id: 'form-error', message: error ?? '' },
    { id: 'nickname-error', message: validationErrors.nicknameError },
    { id: 'body-error', message: validationErrors.bodyError },
  ].filter((entry): entry is { id: string; message: string } => entry.message.length > 0)
  const nicknameDescribedBy = [
    'nickname-help',
    validationErrors.nicknameError && 'nickname-error',
  ].filter(Boolean)
  const bodyDescribedBy = ['body-help', validationErrors.bodyError && 'body-error'].filter(Boolean)

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex h-full items-center justify-center p-4"
        >
          <button
            type="button"
            aria-label="モーダルを閉じる"
            className="absolute inset-0 bg-black/60"
            data-testid="modal-overlay"
            onClick={handleBackdropClick}
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="投稿フォーム"
            className="relative z-10"
          >
            <motion.div
              initial={prefersReducedMotion ? {} : { opacity: 0, scale: SCALE.SHRUNK }}
              animate={prefersReducedMotion ? {} : { opacity: 1, scale: SCALE.NORMAL }}
              exit={prefersReducedMotion ? {} : { opacity: 0, scale: SCALE.SHRUNK }}
              transition={{ duration: DURATION.MODAL }}
              className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">投稿する</h2>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={onClose}
                  className="text-gray-500 hover:text-gray-700"
                >
                  閉じる
                </button>
              </div>

              <form aria-label="投稿フォーム" onSubmit={handleSubmit} className="space-y-4">
                {alertMessages.length > 0 && (
                  <div className="text-sm text-red-500" role="alert">
                    {alertMessages.map((item) => (
                      <p id={item.id} key={item.id}>
                        {item.message}
                      </p>
                    ))}
                  </div>
                )}
                <div>
                  <label htmlFor="nickname" className="block text-sm font-medium">
                    ニックネーム
                  </label>
                  <p id="nickname-help" className="mt-1 text-xs text-slate-500">
                    {TEXT_LENGTH.NICKNAME_MIN}〜{TEXT_LENGTH.NICKNAME_MAX}文字で入力
                  </p>
                  <input
                    id="nickname"
                    type="text"
                    value={nickname}
                    onChange={(event) => handleNicknameChange(event.target.value)}
                    className="mt-1 w-full rounded border px-3 py-2"
                    aria-describedby={nicknameDescribedBy.join(' ')}
                    aria-invalid={validationErrors.nicknameError.length > 0}
                  />
                </div>

                <div>
                  <label htmlFor="body" className="block text-sm font-medium">
                    あるある
                  </label>
                  <p id="body-help" className="mt-1 text-xs text-slate-500">
                    {TEXT_LENGTH.BODY_MIN}〜{TEXT_LENGTH.BODY_MAX}文字で入力
                  </p>
                  <textarea
                    id="body"
                    value={body}
                    onChange={(event) => handleBodyChange(event.target.value)}
                    className="mt-1 w-full rounded border px-3 py-2"
                    rows={3}
                    aria-describedby={bodyDescribedBy.join(' ')}
                    aria-invalid={validationErrors.bodyError.length > 0}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:bg-gray-300"
                >
                  {isLoading ? '投稿中...' : '投稿'}
                </button>
              </form>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  )
}
