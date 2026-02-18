import { test, expect } from './fixtures/test-fixtures'

const MODAL_SCROLL_AMOUNT = 200
const PAGE_WHEEL_DELTA = 1200
const SCROLL_WAIT_MS = 100

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

  test('モーダルを閉じた後にトリガーへフォーカスが戻る', async ({ page }) => {
    // 何を検証するか: 閉じる操作後にプライバシーポリシーボタンへフォーカス復帰すること
    await page.goto('/')

    const trigger = page.getByRole('button', { name: 'プライバシーポリシー' })
    await trigger.click()
    await page.getByRole('button', { name: '閉じる' }).click()

    await expect(trigger).toBeFocused()
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

    await scrollArea.evaluate((element, scrollAmount) => {
      const target = element as HTMLElement
      target.scrollTop = scrollAmount
    }, MODAL_SCROLL_AMOUNT)

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
    await page.mouse.wheel(0, PAGE_WHEEL_DELTA)
    // スクロールイベント反映を待って、フレーキーな判定を避ける。
    await page.waitForTimeout(SCROLL_WAIT_MS)
    const after = await page.evaluate(() => window.scrollY)

    expect(after).toBe(before)
  })
})
