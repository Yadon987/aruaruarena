import { test, expect } from './fixtures/test-fixtures'

type AudioDebugEvent = {
  type: string
  id?: string
  scene?: string
}

test.describe('E18 RED: BGM・SE再生 E2E', () => {
  test('初期表示で音声OFFが表示される', async ({ page }) => {
    // 何を検証するか: 初期状態でサウンドトグルが音声OFF表示になること
    await page.goto('/')

    await expect(page.getByRole('button', { name: '音声OFF' })).toBeVisible()
  })

  test('音声ON切替でlocalStorageがfalseになる', async ({ page }) => {
    // 何を検証するか: トグル操作で aruaru_sound_muted が false へ更新されること
    await page.goto('/')

    await page.getByRole('button', { name: '音声OFF' }).click()

    await expect
      .poll(async () => page.evaluate(() => localStorage.getItem('aruaru_sound_muted')))
      .toBe('false')
  })

  test('トップ画面から審査中画面遷移でBGM切替イベントが1回発生する', async ({ page }) => {
    // 何を検証するか: top->judging 遷移で bgm_judging の再生イベントが1回だけ記録されること
    await page.goto('/')

    await page.getByRole('button', { name: '音声OFF' }).click()
    await page.getByLabel('ニックネーム').fill('テスト太郎')
    await page.getByLabel('あるある本文').fill('これはテスト用のあるある本文です')
    await page.getByRole('button', { name: '投稿する' }).click()

    await expect(page).toHaveURL(/\/judging\//)

    const judgingBgmEvents = await page.evaluate(() => {
      const events = ((window as { __AUDIO_DEBUG__?: AudioDebugEvent[] }).__AUDIO_DEBUG__ ?? [])
      return events.filter((event) => event.type === 'bgm' && event.scene === 'judging').length
    })

    expect(judgingBgmEvents).toBe(1)
  })

  test('結果モーダル表示でse_result_openイベントが1回発生する', async ({ page }) => {
    // 何を検証するか: 結果モーダルを開いたタイミングで se_result_open が1回記録されること
    await page.goto('/')

    await page.getByRole('button', { name: '音声OFF' }).click()
    await page.getByRole('button', { name: '自分の投稿一覧' }).click()
    await page.getByRole('button', { name: '閉じる' }).click()

    const resultSeEvents = await page.evaluate(() => {
      const events = ((window as { __AUDIO_DEBUG__?: AudioDebugEvent[] }).__AUDIO_DEBUG__ ?? [])
      return events.filter((event) => event.type === 'se' && event.id === 'se_result_open').length
    })

    expect(resultSeEvents).toBe(1)
  })
})
