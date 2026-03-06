import { fireEvent, screen } from '@testing-library/react'

export interface PostFormOptions {
  nickname: string
  body: string
}

export interface SubmitPostFormOptions {
  waitForSubmit?: () => Promise<unknown>
}

export async function openPostDialog(): Promise<HTMLElement> {
  fireEvent.click(screen.getByRole('button', { name: '投稿する' }))
  return screen.findByRole('dialog')
}

export function fillPostForm(options: PostFormOptions): void {
  const { nickname, body } = options
  fireEvent.change(screen.getByLabelText('ニックネーム'), {
    target: { value: nickname },
  })
  fireEvent.change(screen.getByLabelText('あるある'), {
    target: { value: body },
  })
}

export async function submitPostForm(options: SubmitPostFormOptions = {}): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: '投稿' }))
  await options.waitForSubmit?.()
}

export async function fillAndSubmitPostForm(
  options: PostFormOptions,
  submitOptions: SubmitPostFormOptions = {}
): Promise<void> {
  await openPostDialog()
  fillPostForm(options)
  await submitPostForm(submitOptions)
}
