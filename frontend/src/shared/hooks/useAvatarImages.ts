import { useEffect, useState } from 'react'
import { getAllAvatarImagePaths } from '../constants/avatar.ts'

interface AvatarImagesState {
  status: 'idle' | 'loaded' | 'error'
  loadedCount: number
  totalCount: number
}

const AVATAR_IMAGE_PATHS = getAllAvatarImagePaths()
const TOTAL_IMAGE_COUNT = AVATAR_IMAGE_PATHS.length

/**
 * アバター画像をプリロードする
 */
export function useAvatarImages(): AvatarImagesState {
  const [state, setState] = useState<AvatarImagesState>({
    status: 'idle',
    loadedCount: 0,
    totalCount: TOTAL_IMAGE_COUNT,
  })

  useEffect(() => {
    let loadedCount = 0

    AVATAR_IMAGE_PATHS.forEach((path) => {
      const image = new Image()

      image.onload = () => {
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
        setState((current) => ({
          ...current,
          status: 'error',
        }))
      }

      image.src = path
    })
  }, [])

  return state
}
