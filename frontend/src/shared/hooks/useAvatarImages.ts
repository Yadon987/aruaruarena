import { useEffect, useRef, useState } from 'react'
import { getAllAvatarImagePaths } from '../constants/avatar.ts'

/**
 * 画像読み込み状態
 *
 * - idle: 初期状態
 * - loaded: 全画像読み込み完了
 * - error: 1枚以上の画像で読み込み失敗
 */
interface AvatarImagesState {
  status: 'idle' | 'loaded' | 'error'
  loadedCount: number
  totalCount: number
}

/** 画像パス一覧（モジュール読み込み時に1回だけ計算） */
const AVATAR_IMAGE_PATHS = getAllAvatarImagePaths()
const TOTAL_IMAGE_COUNT = AVATAR_IMAGE_PATHS.length

/**
 * アバター画像をプリロードするフック
 *
 * @returns 画像読み込み状態
 */
export function useAvatarImages(): AvatarImagesState {
  const [state, setState] = useState<AvatarImagesState>({
    status: 'idle',
    loadedCount: 0,
    totalCount: TOTAL_IMAGE_COUNT,
  })
  const mountedRef = useRef(true)

  useEffect(() => {
    let loadedCount = 0
    mountedRef.current = true
    const images: HTMLImageElement[] = []

    if (TOTAL_IMAGE_COUNT === 0) {
      setState({
        status: 'loaded',
        loadedCount: 0,
        totalCount: 0,
      })
      return
    }

    AVATAR_IMAGE_PATHS.forEach((path) => {
      const image = new Image()
      images.push(image)

      image.onload = () => {
        if (!mountedRef.current) return

        loadedCount += 1

        if (loadedCount === TOTAL_IMAGE_COUNT) {
          setState({
            status: 'loaded',
            loadedCount,
            totalCount: TOTAL_IMAGE_COUNT,
          })
        }
      }

      image.onerror = () => {
        if (!mountedRef.current) return

        setState((current) => ({
          ...current,
          status: 'error',
        }))
      }

      image.src = path
    })

    return () => {
      mountedRef.current = false
      images.forEach((image) => {
        image.onload = null
        image.onerror = null
      })
    }
  }, [])

  return state
}
