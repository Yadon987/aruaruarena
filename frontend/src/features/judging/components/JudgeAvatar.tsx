import { getJudgeAriaLabel } from '../../../shared/constants/avatar.ts'
import { useJudgeAvatar } from '../../../shared/hooks/useJudgeAvatar.ts'
import type { JudgePersona } from '../../../shared/types/domain.ts'

interface JudgeAvatarProps {
  persona: JudgePersona
  isSpeaking?: boolean
  className?: string
}

/**
 * 審査員アバターを表示する
 */
export function JudgeAvatar({ persona, isSpeaking = false, className = '' }: JudgeAvatarProps) {
  const { currentImage } = useJudgeAvatar(persona, isSpeaking)

  return (
    <img
      src={currentImage}
      alt={getJudgeAriaLabel(persona)}
      className={className}
      draggable={false}
    />
  )
}
