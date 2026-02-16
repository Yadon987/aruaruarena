import { test, expect } from './fixtures/test-fixtures'

test.describe('E12-03 自分の投稿管理 RED', () => {
  test('ランキング内の自分の投稿がハイライト表示される', async ({ page }) => {
    // 何を検証するか: 保存済み投稿IDに一致するランキング行が「あなたの投稿」として表示されること
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('my_post_ids', JSON.stringify(['id-1']))
    })
    await page.reload()

    await expect(page.getByText('あなたの投稿')).toBeVisible()
  })

  test('自分の投稿一覧モーダルをキーボード操作で開閉できる', async ({ page }) => {
    // 何を検証するか: 投稿一覧導線がEnter/Spaceで開きEscで閉じられること
    await page.goto('/')

    const trigger = page.getByRole('button', { name: '自分の投稿一覧' })
    await trigger.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog', { name: '自分の投稿' })).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: '自分の投稿' })).toBeHidden()
  })
})
