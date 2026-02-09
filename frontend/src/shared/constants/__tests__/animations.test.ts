import { describe, it, expect } from 'vitest'
// @ts-ignore
import { TRANSITIONS, VARIANTS } from '../animations'

describe('animations constants', () => {
  describe('TRANSITIONS', () => {
    it('page.duration が 0.5 である', () => {
      // 検証内容: 画面遷移のアニメーション時間が仕様通りか
      expect(TRANSITIONS.page.duration).toBe(0.5)
    })

    it('modal.duration が 0.3 である', () => {
      // 検証内容: モーダルのアニメーション時間が仕様通りか
      expect(TRANSITIONS.modal.duration).toBe(0.3)
    })
  })

  describe('VARIANTS', () => {
    it('page に initial, animate, exit が含まれる', () => {
      // 検証内容: 画面遷移用のアニメーション定義が完全か
      expect(VARIANTS.page).toHaveProperty('initial')
      expect(VARIANTS.page).toHaveProperty('animate')
      expect(VARIANTS.page).toHaveProperty('exit')
    })

    it('modal に initial, animate, exit が含まれる', () => {
      // 検証内容: モーダル用のアニメーション定義が完全か
      expect(VARIANTS.modal).toHaveProperty('initial')
      expect(VARIANTS.modal).toHaveProperty('animate')
      expect(VARIANTS.modal).toHaveProperty('exit')
    })

    it('overlay に initial, animate, exit が含まれる', () => {
      // 検証内容: オーバーレイ用のアニメーション定義が完全か
      expect(VARIANTS.overlay).toHaveProperty('initial')
      expect(VARIANTS.overlay).toHaveProperty('animate')
      expect(VARIANTS.overlay).toHaveProperty('exit')
    })

    it('各バリアントに必須プロパティ（opacity等）が存在する', () => {
      // 検証内容: 画面遷移の初期状態は透明度0
      // @ts-ignore
      expect(VARIANTS.page.initial.opacity).toBe(0)
      // 検証内容: 画面遷移のアニメーション完了時は透明度1
      // @ts-ignore
      expect(VARIANTS.page.animate.opacity).toBe(1)
    })
  })
})
