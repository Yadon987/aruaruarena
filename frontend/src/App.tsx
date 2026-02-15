import { FormEvent, useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { queryClient } from './shared/config/queryClient'
import { ApiClientError, api } from './shared/services/api'
import './App.css'

const STORAGE_KEY = 'my_post_ids'

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
    const nextNicknameError = trimmedNickname ? '' : 'ニックネームを入力してください'
    const nextBodyError = trimmedBody.length >= 3 ? '' : '本文は3文字以上で入力してください'

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
      setSuccessMessage('投稿を受け付けました')
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 429) {
        setSubmitError('5分後に再投稿してください')
      } else if (
        error instanceof ApiClientError &&
        [500, 502, 503, 504].includes(error.status)
      ) {
        setSubmitError('一時的なエラーです。時間をおいて再試行してください')
      } else {
        setSubmitError('入力内容を確認してください')
      }
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
