import { useEffect, useRef, useState } from 'react'
import { JUDGE_SPEECH } from '../constants/animations'
import { JUDGE_PHRASES, JUDGES } from '../constants/judgePhrases'
import type { JudgePersona } from '../types/domain'

const SPEECH_INTERVAL_MIN = JUDGE_SPEECH.INTERVAL_MIN_MS
const SPEECH_INTERVAL_MAX = JUDGE_SPEECH.INTERVAL_MAX_MS
const SPEECH_DURATION_MS = JUDGE_SPEECH.DURATION_MS
const IDLE_SPEECH_CYCLE_MS = 8000

interface UseJudgeSpeechOptions {
  isJudging: boolean
  isPostModalOpen: boolean
  allowIdleSpeech?: boolean
}

interface JudgeSpeechState {
  currentSpeech: string | null
  speakingJudge: JudgePersona | null
}

/**
 * 審査員発話アニメーションを制御するフック
 */
export function useJudgeSpeech({
  isJudging,
  isPostModalOpen,
  allowIdleSpeech = false,
}: UseJudgeSpeechOptions): JudgeSpeechState {
  const [currentSpeech, setCurrentSpeech] = useState<string | null>(null)
  const [speakingJudge, setSpeakingJudge] = useState<JudgePersona | null>(null)

  const intervalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const durationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSpeechRef = useRef<string | null>(null)

  const clearAllTimers = () => {
    if (intervalTimerRef.current) {
      clearTimeout(intervalTimerRef.current)
      intervalTimerRef.current = null
    }
    if (durationTimerRef.current) {
      clearTimeout(durationTimerRef.current)
      durationTimerRef.current = null
    }
  }

  const getRandomInterval = (): number => {
    if (allowIdleSpeech && !isJudging) {
      return Math.max(0, IDLE_SPEECH_CYCLE_MS - SPEECH_DURATION_MS)
    }

    return SPEECH_INTERVAL_MIN + Math.random() * (SPEECH_INTERVAL_MAX - SPEECH_INTERVAL_MIN)
  }

  const getRandomJudge = (): JudgePersona => {
    if (JUDGES.length === 0) {
      throw new Error('No judges configured')
    }
    const index = Math.floor(Math.random() * JUDGES.length)
    return JUDGES[index]
  }

  const getRandomSpeech = (judge: JudgePersona): string => {
    const phrases = JUDGE_PHRASES[judge]
    if (!phrases || phrases.length === 0) {
      return '...'
    }
    const availablePhrases = phrases.filter((phrase) => phrase !== lastSpeechRef.current)
    const pool = availablePhrases.length > 0 ? availablePhrases : phrases
    const speech = pool[Math.floor(Math.random() * pool.length)]
    lastSpeechRef.current = speech
    return speech
  }

  const startSpeech = () => {
    const judge = getRandomJudge()
    const speech = getRandomSpeech(judge)
    setSpeakingJudge(judge)
    setCurrentSpeech(speech)

    durationTimerRef.current = setTimeout(() => {
      setCurrentSpeech(null)
      setSpeakingJudge(null)
      scheduleNextSpeech()
    }, SPEECH_DURATION_MS)
  }

  const scheduleNextSpeech = () => {
    intervalTimerRef.current = setTimeout(() => {
      startSpeech()
    }, getRandomInterval())
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if ((!isJudging && !allowIdleSpeech) || isPostModalOpen) {
      clearAllTimers()
      setCurrentSpeech(null)
      setSpeakingJudge(null)
      lastSpeechRef.current = null
      return
    }

    scheduleNextSpeech()

    return () => {
      clearAllTimers()
    }
  }, [allowIdleSpeech, isJudging, isPostModalOpen])

  return { currentSpeech, speakingJudge }
}
