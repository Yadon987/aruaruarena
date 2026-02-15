import { FormEvent, useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { queryClient } from './shared/config/queryClient'
import { ApiClientError, api } from './shared/services/api'
import './App.css'

const STORAGE_KEY = 'my_post_ids'
const MIN_BODY_LENGTH = 3
const RATE_LIMIT_STATUS = 429
const SERVER_ERROR_STATUSES = [500, 502, 503, 504]
const MESSAGE_NICKNAME_REQUIRED = 'ニックネームを入力してください'
const MESSAGE_BODY_REQUIRED = '本文は3文字以上で入力してください'
const MESSAGE_SUCCESS = '投稿を受け付けました'
const MESSAGE_RATE_LIMITED = '5分後に再投稿してください'
const MESSAGE_SERVER_ERROR = '一時的なエラーです。時間をおいて再試行してください'
const MESSAGE_DEFAULT_ERROR = 'エラーが発生しました。再試行してください'

type ValidationErrors = {
  nicknameError: string
  bodyError: string
}

function readPostIds(): string[] {
  const rawValue = localStorage.getItem(STORAGE_KEY)
  if (!rawValue) return []
  try {
    const parsed = JSON.parse(rawValue)
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

function savePostId(id: string) {
  const current = readPostIds()
  localStorage.setItem(STORAGE_KEY, JSON.stringify([id, ...current]))
}

function validateForm(nickname: string, body: string): ValidationErrors {
  const trimmedNickname = nickname.trim()
  const trimmedBody = body.trim()
  return {
    nicknameError: trimmedNickname ? '' : MESSAGE_NICKNAME_REQUIRED,
    bodyError: trimmedBody.length >= MIN_BODY_LENGTH ? '' : MESSAGE_BODY_REQUIRED,
  }
}

// APIクライアントの例外種別をUI文言へ変換する
function resolveSubmitErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError && error.status === RATE_LIMIT_STATUS) {
    return MESSAGE_RATE_LIMITED
  }
  if (error instanceof ApiClientError && SERVER_ERROR_STATUSES.includes(error.status)) {
    return MESSAGE_SERVER_ERROR
  }
  if (
    error instanceof ApiClientError &&
    ['NETWORK_ERROR', 'TIMEOUT', 'HTTP_ERROR'].includes(error.code)
  ) {
    return MESSAGE_DEFAULT_ERROR
  }
  // APIが返した具体的な文言があれば優先し、未知エラー時のみ汎用文言を使う
  if (error instanceof ApiClientError && error.message && !error.message.startsWith('HTTP ')) {
    return error.message
  }
  return MESSAGE_DEFAULT_ERROR
}

function App() {
  const [nickname, setNickname] = useState('')
  const [body, setBody] = useState('')
  const [nicknameError, setNicknameError] = useState('')
  const [bodyError, setBodyError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (isSubmitting) return

    const trimmedNickname = nickname.trim()
    const trimmedBody = body.trim()
    const { nicknameError: nextNicknameError, bodyError: nextBodyError } = validateForm(
      trimmedNickname,
      trimmedBody
    )

    setNicknameError(nextNicknameError)
    setBodyError(nextBodyError)
    setSubmitError('')
    setSuccessMessage('')

    if (nextNicknameError || nextBodyError) {
      return
    }

    setIsSubmitting(true)
    try {
      const response = await api.posts.create({ nickname: trimmedNickname, body: trimmedBody })
      savePostId(response.id)
      setNickname('')
      setBody('')
      setSuccessMessage(MESSAGE_SUCCESS)
    } catch (error) {
      setSubmitError(resolveSubmitErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="p-6">
        <header role="banner" className="mb-4">
          <h1 className="text-2xl font-bold">あるあるアリーナ</h1>
        </header>

        <form aria-label="投稿フォーム" onSubmit={onSubmit} className="mb-4 space-y-2">
          <div>
            <label htmlFor="nickname">ニックネーム</label>
            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="block w-full border rounded p-2"
            />
            {nicknameError && <p>{nicknameError}</p>}
          </div>
          <div>
            <label htmlFor="body">あるある本文</label>
            <textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="block w-full border rounded p-2"
            />
            {bodyError && <p>{bodyError}</p>}
          </div>
          <button type="submit" disabled={isSubmitting} className="px-4 py-2 border rounded">
            投稿する
          </button>
          {submitError && <p>{submitError}</p>}
          {successMessage && <p>{successMessage}</p>}
        </form>

        <section role="region" aria-label="ランキング表示エリア" className="mb-4">
          <h2 className="text-lg font-semibold">ランキング</h2>
          <p>ランキングは準備中です</p>
        </section>

        <footer role="contentinfo">
          <p>フッター</p>
        </footer>
      </div>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}

export default App
