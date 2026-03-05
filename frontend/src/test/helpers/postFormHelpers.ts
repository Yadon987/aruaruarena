import { fireEvent, screen } from '@testing-library/react'

export interface PostFormOptions {
  nickname: string
  body: string
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

export function submitPostForm(): void {
  fireEvent.click(screen.getByRole('button', { name: '投稿' }))
}

export async function fillAndSubmitPostForm(options: PostFormOptions): Promise<void> {
  await openPostDialog()
  fillPostForm(options)
  submitPostForm()
}
