import { test, expect } from './fixtures/test-fixtures'

test.describe('E12-01 RED: トップ画面と投稿フォーム', () => {
  test('トップ画面の主要要素が表示される', async ({ page }) => {
    // 何を検証するか: ヘッダー・投稿フォーム・ランキング領域・フッターの表示
    await page.goto('/')

    await expect(page.getByRole('banner')).toBeVisible()
    await expect(page.getByRole('form', { name: '投稿フォーム' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'ランキング表示エリア' })).toBeVisible()
    await expect(page.getByRole('contentinfo')).toBeVisible()
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

    await page.getByLabel('ニックネーム').fill('E2E太郎')
    await page.getByLabel('あるある本文').fill('E2E投稿本文です')
    await page.getByRole('button', { name: '投稿する' }).click()

    await expect(page.getByText('投稿を受け付けました')).toBeVisible()
  })

  test('入力不備で送信できずバリデーションが表示される', async ({ page }) => {
    // 何を検証するか: 必須入力不足時にエラー表示されること
    await page.goto('/')

    await page.getByRole('button', { name: '投稿する' }).click()

    await expect(page.getByText('ニックネームを入力してください')).toBeVisible()
    await expect(page.getByText('本文は3文字以上で入力してください')).toBeVisible()
  })

  test('429応答時に専用メッセージが表示される', async ({ page }) => {
    // 何を検証するか: レート制限時に専用エラーメッセージが表示されること
    await page.route('**/api/posts', async (route) => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ error: '投稿頻度を制限中', code: 'RATE_LIMITED' }),
      })
    })

    await page.goto('/')

    await page.getByLabel('ニックネーム').fill('制限E2E')
    await page.getByLabel('あるある本文').fill('レート制限確認本文')
    await page.getByRole('button', { name: '投稿する' }).click()

    await expect(page.getByText('5分後に再投稿してください')).toBeVisible()
  })
})
