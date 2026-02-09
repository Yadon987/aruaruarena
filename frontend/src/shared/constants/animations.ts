export const TRANSITIONS = {
  page: { duration: 0.5, ease: 'easeInOut' },
  modal: { duration: 0.3, ease: 'easeOut' },
  fadeIn: { duration: 0.2, ease: 'easeIn' },
} as const

export const VARIANTS = {
  page: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  modal: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
  },
  overlay: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
} as const
