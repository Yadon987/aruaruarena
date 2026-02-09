/**
 * アニメーションの継続時間（秒）
 */
export const DURATION = {
  /** 画面遷移アニメーションの時間 */
  PAGE_TRANSITION: 0.5,
  /** モーダルアニメーションの時間 */
  MODAL: 0.3,
  /** フェードインアニメーションの時間 */
  FADE_IN: 0.2,
} as const

/**
 * 透明度の値
 */
export const OPACITY = {
  /** 完全に透明 */
  HIDDEN: 0,
  /** 完全に不透明 */
  VISIBLE: 1,
} as const

/**
 * スケールの値
 */
export const SCALE = {
  /** 縮小（モーダル初期状態） */
  SHRUNK: 0.95,
  /** 通常サイズ */
  NORMAL: 1,
} as const

/**
 * アニメーション遷移設定
 */
export const TRANSITIONS = {
  /** 画面遷移（フルスクリーン切り替え） */
  page: { duration: DURATION.PAGE_TRANSITION, ease: 'easeInOut' },
  /** モーダル表示/非表示 */
  modal: { duration: DURATION.MODAL, ease: 'easeOut' },
  /** 要素のフェードイン */
  fadeIn: { duration: DURATION.FADE_IN, ease: 'easeIn' },
} as const

/**
 * アニメーションバリアント（初期状態・終了状態）
 */
export const VARIANTS = {
  /** 画面遷移用 */
  page: {
    initial: { opacity: OPACITY.HIDDEN },
    animate: { opacity: OPACITY.VISIBLE },
    exit: { opacity: OPACITY.HIDDEN },
  },
  /** モーダル用 */
  modal: {
    initial: { opacity: OPACITY.HIDDEN, scale: SCALE.SHRUNK },
    animate: { opacity: OPACITY.VISIBLE, scale: SCALE.NORMAL },
    exit: { opacity: OPACITY.HIDDEN, scale: SCALE.SHRUNK },
  },
  /** オーバーレイ背景用 */
  overlay: {
    initial: { opacity: OPACITY.HIDDEN },
    animate: { opacity: OPACITY.VISIBLE },
    exit: { opacity: OPACITY.HIDDEN },
  },
} as const
