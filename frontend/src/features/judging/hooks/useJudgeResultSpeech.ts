import { useEffect, useMemo, useState } from 'react'
import { JUDGE_PERSONA_ORDER, JUDGE_SPEECH } from '../../../shared/constants/animations'
import type { JudgePersona, Judgment } from '../../../shared/types/domain'

const RESULT_SPEECH_ORDER: readonly JudgePersona[] = JUDGE_PERSONA_ORDER
const RESULT_SPEECH_INTERVAL_MS = JUDGE_SPEECH.DURATION_MS + 300

type DisplayedComments = Partial<Record<JudgePersona, string>>

interface OrderedComment {
  persona: JudgePersona
  comment: string
}

interface UseJudgeResultSpeechOptions {
  judgments?: Judgment[]
  isActive?: boolean
}

interface UseJudgeResultSpeechResult {
  displayedComments: DisplayedComments
  activeJudge: JudgePersona | null
}

function buildOrderedComments(judgments?: Judgment[]): OrderedComment[] {
  if (!judgments || judgments.length === 0) return []

  return RESULT_SPEECH_ORDER.reduce<OrderedComment[]>((result, persona) => {
    const comment = judgments.find((judgment) => judgment.persona === persona)?.comment?.trim()
    if (comment) {
      result.push({ persona, comment })
    }
    return result
  }, [])
}

export function useJudgeResultSpeech({
  judgments,
  isActive = false,
}: UseJudgeResultSpeechOptions): UseJudgeResultSpeechResult {
  const [displayedComments, setDisplayedComments] = useState<DisplayedComments>({})
  const [activeJudge, setActiveJudge] = useState<JudgePersona | null>(null)
  const orderedComments = useMemo(() => buildOrderedComments(judgments), [judgments])

  useEffect(() => {
    if (!isActive || orderedComments.length === 0) {
      setDisplayedComments((previous) => (Object.keys(previous).length === 0 ? previous : {}))
      setActiveJudge(null)
      return
    }

    setDisplayedComments({
      [orderedComments[0].persona]: orderedComments[0].comment,
    })
    setActiveJudge(orderedComments[0].persona)

    let nextIndex = 1
    const timerId = window.setInterval(() => {
      if (nextIndex >= orderedComments.length) {
        window.clearInterval(timerId)
        setActiveJudge(null)
        return
      }

      const nextComment = orderedComments[nextIndex]
      setDisplayedComments((previous) => ({
        ...previous,
        [nextComment.persona]: nextComment.comment,
      }))
      setActiveJudge(nextComment.persona)
      nextIndex += 1
    }, RESULT_SPEECH_INTERVAL_MS)

    return () => {
      window.clearInterval(timerId)
    }
  }, [isActive, orderedComments])

  return { displayedComments, activeJudge }
}
