import { test, expect } from './fixtures/test-fixtures'

test.describe('E17 RED: プライバシーポリシーモーダル E2E', () => {
  test('トップ画面から開いて閉じる', async ({ page }) => {
    // 何を検証するか: フッター導線からモーダルを開き、閉じる操作ができること
    await page.goto('/')

    await page.getByRole('button', { name: 'プライバシーポリシー' }).click()
    await expect(page.getByRole('dialog', { name: 'プライバシーポリシー' })).toBeVisible()

    await page.getByRole('button', { name: '閉じる' }).click()
    await expect(page.getByRole('dialog', { name: 'プライバシーポリシー' })).toBeHidden()
  })

  test('Escキーでモーダルを閉じる', async ({ page }) => {
    // 何を検証するか: モーダル表示中にEscキー押下で閉じられること
    await page.goto('/')

    await page.getByRole('button', { name: 'プライバシーポリシー' }).click()
    await expect(page.getByRole('dialog', { name: 'プライバシーポリシー' })).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'プライバシーポリシー' })).toBeHidden()
  })

  test('本文領域がスクロール可能である', async ({ page }) => {
    // 何を検証するか: 本文領域でスクロール可能条件を満たし実際にスクロールできること
    await page.goto('/')

    await page.getByRole('button', { name: 'プライバシーポリシー' }).click()

    const scrollArea = page.getByTestId('privacy-policy-scroll-area')
    const before = await scrollArea.evaluate((element) => {
      const target = element as HTMLElement
      return {
        scrollHeight: target.scrollHeight,
        clientHeight: target.clientHeight,
        scrollTop: target.scrollTop,
      }
    })

    await scrollArea.evaluate((element) => {
      const target = element as HTMLElement
      target.scrollTop = 200
    })

    const after = await scrollArea.evaluate((element) => {
      const target = element as HTMLElement
      return {
        scrollTop: target.scrollTop,
      }
    })

    expect(before.scrollHeight).toBeGreaterThan(before.clientHeight)
    expect(after.scrollTop).toBeGreaterThan(before.scrollTop)
  })

  test('モーダル表示中は背景ページがスクロールしない', async ({ page }) => {
    // 何を検証するか: モーダル表示中にbodyの背景スクロールが抑止されること
    await page.goto('/')

    await page.getByRole('button', { name: 'プライバシーポリシー' }).click()

    const before = await page.evaluate(() => window.scrollY)
    await page.mouse.wheel(0, 1200)
    const after = await page.evaluate(() => window.scrollY)

    expect(after).toBe(before)
  })
})
