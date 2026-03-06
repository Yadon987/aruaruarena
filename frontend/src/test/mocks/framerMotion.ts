import { createElement, Fragment } from 'react'
import type { ButtonHTMLAttributes, HTMLAttributes, ImgHTMLAttributes, ReactNode } from 'react'
import { vi } from 'vitest'

type DivProps = HTMLAttributes<HTMLDivElement> & { children?: ReactNode }
type SpanProps = HTMLAttributes<HTMLSpanElement> & { children?: ReactNode }
type ImgProps = ImgHTMLAttributes<HTMLImageElement>
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { children?: ReactNode }

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
      div: ({ children, ...props }: DivProps) => createElement('div', props, children),
      img: ({ src, alt, ...props }: ImgProps) => {
        capturedMotionImgProps.push({ src, alt, ...props })
        return createElement('img', { src, alt, ...props })
      },
      span: ({ children, ...props }: SpanProps) => createElement('span', props, children),
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
