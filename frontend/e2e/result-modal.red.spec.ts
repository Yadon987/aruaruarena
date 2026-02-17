import { test, expect } from './fixtures/test-fixtures'

test.describe('E15-01 RED: 結果モーダルUI', () => {
  test('ランキング項目クリックで結果モーダルと審査員3件を表示する', async ({ page }) => {
    // 何を検証するか: ランキング項目クリックで結果モーダルが開き、審査員カード3件が表示されること
    await page.goto('/')

    await page.getByTestId('ranking-item').first().click()

    await expect(page.getByRole('dialog', { name: '審査結果モーダル' })).toBeVisible()
    await expect(page.getByTestId('judge-result-card')).toHaveCount(3)
  })

  test('Escでモーダルを閉じてトリガー要素へフォーカス復帰する', async ({ page }) => {
    // 何を検証するか: Escで結果モーダルを閉じ、起動した要素にフォーカス復帰すること
    await page.goto('/')

    const trigger = page.getByTestId('ranking-item').first()
    await trigger.click()
    await page.keyboard.press('Escape')

    await expect(page.getByRole('dialog', { name: '審査結果モーダル' })).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('NOT_FOUND時と500時でエラー表示を分岐する', async ({ page }) => {
    // 何を検証するか: NOT_FOUNDは投稿が見つかりません、500系は取得失敗と再試行導線を表示すること
    await page.goto('/?e2e_case=result_not_found')

    await page.getByTestId('ranking-item').first().click()
    await expect(page.getByText('投稿が見つかりません')).toBeVisible()

    await page.goto('/?e2e_case=result_server_error')
    await page.getByTestId('ranking-item').first().click()
    await expect(page.getByText('投稿詳細の取得に失敗しました')).toBeVisible()
    await expect(page.getByRole('button', { name: '再試行' })).toBeVisible()
  })
})
