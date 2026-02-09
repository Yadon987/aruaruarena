import { useEffect, useState } from 'react'

/**
 * Reduced Motion（アニメーション削減）設定を検知するカスタムフック
 *
 * ユーザーのOS設定で「アニメーションを減らす」が有効かどうかを検出
 * アクセシビリティ対応のため使用
 *
 * @returns Reduced Motionが有効な場合はtrue
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)

    const handler = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches)
    }

    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  return prefersReducedMotion
}
