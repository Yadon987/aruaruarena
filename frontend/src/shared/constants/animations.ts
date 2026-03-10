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

/**
 * 審査員登場アニメーション関連の定数
 */
export const JUDGE_ENTRANCE = {
  /** 登場完了までの時間（ms）- 中尾彬風のアニメーション時間に合わせる */
  DURATION_MS: 4400,
  /** 各審査員の登場バリアント */
  VARIANTS: {
    hiroyuki: {
      initial: { y: 100, x: -140, opacity: 1, scale: 0.75, rotate: 5 },
      animate: {
        y: [0, -20, 0, -10, 0, 7, -2, 0],
        x: [-140, -95, -55, -20, 0, 0, 0, 0],
        opacity: 1,
        scale: [1, 1.06, 1, 1.03, 1, 0.94, 1.01, 1],
        rotate: [5, 2, 0, 1, 0, -1, 0.4, 0],
      },
      transition: {
        duration: 1.3,
        ease: [0.22, 0.8, 0.24, 1],
        times: [0, 0.16, 0.32, 0.48, 0.64, 0.82, 0.92, 1],
      },
    },
    dewi: {
      initial: { x: 220, y: -140, opacity: 0, scale: 0.84, rotate: 8 },
      animate: {
        x: [220, 180, 136, 94, 56, 22, 0, 0, 0],
        y: [-140, -118, -94, -72, -48, -24, 0, 8, 0],
        opacity: [0, 0, 0.08, 0.2, 0.38, 0.56, 0.76, 0.92, 1],
        scale: [0.84, 0.88, 0.92, 0.96, 1, 1.03, 1, 0.97, 1],
        rotate: [8, 6, 4.5, 3, 2, 1, 0, -3, 0],
      },
      transition: {
        duration: 4.8,
        ease: [0.2, 0.86, 0.24, 1],
        times: [0, 0.14, 0.28, 0.42, 0.56, 0.7, 0.82, 0.93, 1],
      },
    },
    nakao: {
      initial: { y: 110, x: -300, opacity: 1, scale: 0.9, rotate: -5.5 },
      animate: {
        y: [0, -6, 4, -5, 6, -4, 9, 3, 16, -4, 0],
        x: [-300, -266, -230, -192, -150, -108, -66, -28, 0, 0, 0],
        opacity: 1,
        scale: [0.9, 0.95, 0.965, 0.99, 1, 1.016, 1.028, 1.02, 0.9, 1.012, 1],
        rotate: [-5.5, -4.2, -3.1, -2, -1.2, -0.6, -0.2, 0.2, -1.4, 0.3, 0],
      },
      transition: {
        duration: 4.4,
        ease: [0.18, 0.08, 0.2, 1],
        times: [0, 0.1, 0.2, 0.3, 0.42, 0.54, 0.66, 0.78, 0.9, 0.96, 1],
      },
    },
  },
} as const

/**
 * 審査員発話アニメーション関連の定数
 */
export const JUDGE_SPEECH = {
  /** 発話間隔の最小値（ms） - ほぼ連続で発話させる */
  INTERVAL_MIN_MS: 0,
  /** 発話間隔の最大値（ms） - 最大でも0.5秒の間隔 */
  INTERVAL_MAX_MS: 500,
  /** 発話表示時間（ms） */
  DURATION_MS: 2500,
  /** 吹き出しアニメーション */
  BUBBLE_VARIANTS: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 10 },
  },
} as const
