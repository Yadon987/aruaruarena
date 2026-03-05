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
  DURATION_MS: 1200,
  /** 各審査員の登場バリアント */
  VARIANTS: {
    hiroyuki: {
      initial: { y: 100, x: -30, opacity: 0, scale: 0.8 },
      animate: { y: 0, x: 0, opacity: 1, scale: 1 },
      transition: { type: 'spring', bounce: 0.4, duration: 0.8 },
    },
    dewi: {
      initial: { x: 200, opacity: 0 },
      animate: { x: 0, opacity: 1 },
      transition: { duration: 1.0, ease: 'easeOut' },
    },
    nakao: {
      initial: { x: -200, opacity: 0, scale: 0.9 },
      animate: { x: 0, opacity: 1, scale: 1 },
      transition: { duration: 1.2, ease: [0.25, 0.1, 0.25, 1] },
    },
  },
} as const

/**
 * 審査員発話アニメーション関連の定数
 */
export const JUDGE_SPEECH = {
  /** 発話間隔の最小値（ms） */
  INTERVAL_MIN_MS: 4000,
  /** 発話間隔の最大値（ms） */
  INTERVAL_MAX_MS: 6000,
  /** 発話表示時間（ms） */
  DURATION_MS: 2500,
  /** 吹き出しアニメーション */
  BUBBLE_VARIANTS: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 10 },
  },
} as const
