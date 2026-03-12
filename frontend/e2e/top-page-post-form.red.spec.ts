import { type Page } from '@playwright/test'
import { expect, test } from './fixtures/test-fixtures'

async function dismissAudioConsentModal(page: Page) {
  const rejectButton = page.getByRole('button', { name: 'いいえ' })
  const dialog = page.getByRole('alertdialog', { name: '音声を再生しますか？' })

  if (await rejectButton.count() === 0) return
  if (await rejectButton.isVisible()) {
    await rejectButton.click()
    await dialog.waitFor({ state: 'detached', timeout: 2000 })
  }
}

async function openPostForm(page: Page) {
  await dismissAudioConsentModal(page)
  await page.getByRole('button', { name: '投稿する' }).click()
  await expect(page.getByRole('dialog', { name: '投稿フォーム' })).toBeVisible()
}

async function fillPostForm(page: Page, nickname: string, body: string) {
  const form = page.getByRole('dialog', { name: '投稿フォーム' })
  await form.getByLabel('ニックネーム').fill(nickname)
  await form.getByLabel('あるある').fill(body)
}

async function submitPostForm(page: Page) {
  const form = page.getByRole('dialog', { name: '投稿フォーム' })
  await form.getByRole('button', { name: '投稿' }).click()
}

test.describe('E12-01 RED: トップ画面と投稿フォーム', () => {
  test('トップ画面の主要要素が表示される', async ({ page }) => {
    // 何を検証するか: 投稿導線と主要セクションの表示
    await page.goto('/')
    await dismissAudioConsentModal(page)

    await expect(page.getByRole('button', { name: '投稿する' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'ランキング' })).toBeVisible()
  })

  test('正常入力で投稿できる', async ({ page }) => {
    // 何を検証するか: 有効入力で投稿ボタン押下後に成功フローが実行されること
    await page.route('**/api/posts', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'e2e-post-1', status: 'judging' }),
      })
    })

    await page.goto('/')
    await openPostForm(page)
    await fillPostForm(page, 'E2E太郎', 'E2E投稿本文です')
    await submitPostForm(page)

    await expect(page).toHaveURL(/\/judging\/e2e-post-1$/)
  })

  test('入力不備で送信できずバリデーションが表示される', async ({ page }) => {
    // 何を検証するか: 必須入力不足時にエラー表示されること
    await page.goto('/')
    await openPostForm(page)
    await submitPostForm(page)

    await expect(page.getByText('ニックネームを入力してください')).toBeVisible()
    await expect(page.getByText('本文を入力してください')).toBeVisible()
  })

  test('429応答時に専用メッセージが表示される', async ({ page }) => {
    // 何を検証するか: レート制限時に専用メッセージが表示されること
    await page.route('**/api/posts', async (route) => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          error: '投稿頻度を制限中',
          code: 'RATE_LIMITED',
        }),
      })
    })

    await page.goto('/')
    await openPostForm(page)
    await fillPostForm(page, '制限E2E', 'レート制限確認本文')
    await submitPostForm(page)

    await expect(page.getByText('アクセスが集中しています。時間をおいて再度お試しください')).toBeVisible()
  })
})
