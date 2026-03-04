import { getJudgeAriaLabel } from '../../../shared/constants/avatar.ts'
import { useJudgeAvatar } from '../../../shared/hooks/useJudgeAvatar.ts'
import type { JudgePersona } from '../../../shared/types/domain.ts'

/**
 * 審査員アバターコンポーネントのProps
 */
interface JudgeAvatarProps {
  /** 審査員ペルソナ */
  persona: JudgePersona
  /** 発話中フラグ */
  isSpeaking?: boolean
  /** 追加CSSクラス */
  className?: string
}

/**
 * 審査員アバターを表示する
 */
export function JudgeAvatar({ persona, isSpeaking = false, className = '' }: JudgeAvatarProps) {
  const { currentImage, currentState } = useJudgeAvatar(persona, isSpeaking)

  return (
    <img
      src={currentImage}
      alt={getJudgeAriaLabel(persona)}
      className={className}
      aria-hidden={currentState !== 'base'}
      draggable={false}
    />
  )
}
