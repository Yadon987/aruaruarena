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

/**
 * 投稿ボタンのクリックを実行する。
 *
 * `waitForSubmit` を指定しない場合、submitPostForm が待つのはクリック完了まで。
 * 送信後の非同期UI変化まで待機したい場合は `waitForSubmit` を渡す。
 * 例: `waitForSubmit: () => screen.findByTestId('judging-screen')`
 *
 * `fillAndSubmitPostForm` から利用する際も同様に、必要なら submitOptions 経由で
 * waitForSubmit を渡して送信後の完了条件を明示する。
 */
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
