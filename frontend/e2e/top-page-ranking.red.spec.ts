import { test, expect } from './fixtures/test-fixtures'

test.describe('E12-02 ランキング RED', () => {
  test('トップ画面にランキング領域が表示される', async ({ page }) => {
    // 何を検証するか: ランキング表示エリアがブラウザ上で確認できること
    await page.goto('/')

    await expect(page.getByRole('region', { name: 'ランキング表示エリア' })).toBeVisible()
  })

  test('3秒ポーリングでランキング表示が更新される', async ({ page }) => {
    // 何を検証するか: 3秒ごとのポーリングでランキング表示が更新されること
    await page.goto('/')

    const firstRanking = page.getByTestId('ranking-item').first()
    await expect(firstRanking).toHaveText(/.+/)

    await page.waitForTimeout(3200)

    await expect(firstRanking).toHaveText(/更新済み/)
  })
})
