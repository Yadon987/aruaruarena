import { createElement, forwardRef, Fragment } from 'react'
import type { ButtonHTMLAttributes, HTMLAttributes, ImgHTMLAttributes, ReactNode } from 'react'
import { vi } from 'vitest'

const MotionSectionMock = forwardRef<HTMLElement, MotionComponentProps>(
  ({ children, ...props }, ref) =>
    createElement('section', { ...stripMotionProps(props), ref }, children)
)

MotionSectionMock.displayName = 'MockMotionSection'

type ImgProps = ImgHTMLAttributes<HTMLImageElement>
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { children?: ReactNode }

type MotionComponentProps = HTMLAttributes<HTMLElement> & {
  children?: ReactNode
  initial?: unknown
  animate?: unknown
  exit?: unknown
  transition?: unknown
}

const stripMotionProps = (props: MotionComponentProps): Record<string, unknown> => {
  const {
    initial: _initial,
    animate: _animate,
    exit: _exit,
    transition: _transition,
    ...domProps
  } = props
  return domProps
}

export const capturedMotionImgProps: Array<Record<string, unknown>> = []

export function resetCapturedMotionImgProps(): void {
  capturedMotionImgProps.length = 0
}

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion')

  return {
    ...actual,
    motion: {
      ...actual.motion,
      div: ({ children, ...props }: MotionComponentProps) =>
        createElement('div', stripMotionProps(props), children),
      img: ({ src, alt, ...props }: ImgProps) => {
        const motionProps = props as MotionComponentProps
        const domProps = stripMotionProps(motionProps)
        capturedMotionImgProps.push({
          src,
          alt,
          ...domProps,
          initial: motionProps.initial,
          animate: motionProps.animate,
          exit: motionProps.exit,
          transition: motionProps.transition,
        })
        return createElement('img', { src, alt, ...domProps })
      },
      section: MotionSectionMock,
      span: ({ children, ...props }: MotionComponentProps) =>
        createElement('span', stripMotionProps(props), children),
      button: ({ children, ...props }: ButtonProps) =>
        createElement('button', { type: props.type ?? 'button', ...props }, children),
    },
    AnimatePresence: ({ children }: { children?: ReactNode }) =>
      createElement(Fragment, null, children),
  }
})

export async function loadComponent<T>(importFn: () => Promise<T>): Promise<T> {
  // 動的importの呼び出しを共通化し、将来の拡張ポイントを1箇所に集約する。
  return importFn()
}
