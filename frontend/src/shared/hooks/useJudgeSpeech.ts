import { useCallback, useEffect, useRef, useState } from 'react'
import { JUDGE_SPEECH } from '../constants/animations'
import { JUDGE_LOW_SCORE_PHRASES, JUDGE_PHRASES, JUDGES } from '../constants/judgePhrases'
import type { JudgePersona } from '../types/domain'

const SPEECH_INTERVAL_MIN = JUDGE_SPEECH.INTERVAL_MIN_MS
const SPEECH_INTERVAL_MAX = JUDGE_SPEECH.INTERVAL_MAX_MS
const SPEECH_DURATION_MS = JUDGE_SPEECH.DURATION_MS
const IDLE_SPEECH_CYCLE_MS = 8000

interface UseJudgeSpeechOptions {
  isJudging: boolean
  isPostModalOpen: boolean
  allowIdleSpeech?: boolean
  isLowScore?: boolean
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
  isLowScore = false,
}: UseJudgeSpeechOptions): JudgeSpeechState {
  const [currentSpeech, setCurrentSpeech] = useState<string | null>(null)
  const [speakingJudge, setSpeakingJudge] = useState<JudgePersona | null>(null)

  const intervalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const durationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSpeechRef = useRef<string | null>(null)
  const lastSpeakingJudgeRef = useRef<JudgePersona | null>(null)
  const scheduleNextSpeechRef = useRef(() => {})

  const clearAllTimers = useCallback(() => {
    if (intervalTimerRef.current) {
      clearTimeout(intervalTimerRef.current)
      intervalTimerRef.current = null
    }
    if (durationTimerRef.current) {
      clearTimeout(durationTimerRef.current)
      durationTimerRef.current = null
    }
  }, [])

  const getRandomInterval = useCallback((): number => {
    if (allowIdleSpeech && !isJudging) {
      return Math.max(0, IDLE_SPEECH_CYCLE_MS - SPEECH_DURATION_MS)
    }

    return SPEECH_INTERVAL_MIN + Math.random() * (SPEECH_INTERVAL_MAX - SPEECH_INTERVAL_MIN)
  }, [allowIdleSpeech, isJudging])

  const getRandomJudge = useCallback((): JudgePersona => {
    if (JUDGES.length === 0) {
      throw new Error('No judges configured')
    }
    const availableJudges = JUDGES.filter((judge) => judge !== lastSpeakingJudgeRef.current)
    const pool = availableJudges.length > 0 ? availableJudges : JUDGES
    const index = Math.floor(Math.random() * pool.length)
    const selectedJudge = pool[index]
    lastSpeakingJudgeRef.current = selectedJudge
    return selectedJudge
  }, [])

  const getRandomSpeech = useCallback((judge: JudgePersona, isLowScore: boolean): string => {
    const phrases = isLowScore ? JUDGE_LOW_SCORE_PHRASES[judge] : JUDGE_PHRASES[judge]
    if (!phrases || phrases.length === 0) {
      return '...'
    }
    const availablePhrases = phrases.filter((phrase) => phrase !== lastSpeechRef.current)
    const pool = availablePhrases.length > 0 ? availablePhrases : phrases
    const speech = pool[Math.floor(Math.random() * pool.length)]
    lastSpeechRef.current = speech
    return speech
  }, [])

  const startSpeech = useCallback(() => {
    const judge = getRandomJudge()
    const speech = getRandomSpeech(judge, isLowScore)
    setSpeakingJudge(judge)
    setCurrentSpeech(speech)

    durationTimerRef.current = setTimeout(() => {
      setCurrentSpeech(null)
      setSpeakingJudge(null)
      scheduleNextSpeechRef.current()
    }, SPEECH_DURATION_MS)
  }, [getRandomJudge, getRandomSpeech, isLowScore])

  const scheduleNextSpeech = useCallback(() => {
    intervalTimerRef.current = setTimeout(() => {
      startSpeech()
    }, getRandomInterval())
  }, [getRandomInterval, startSpeech])

  useEffect(() => {
    scheduleNextSpeechRef.current = scheduleNextSpeech
  }, [scheduleNextSpeech])

  useEffect(() => {
    if ((!isJudging && !allowIdleSpeech) || isPostModalOpen) {
      clearAllTimers()
      setCurrentSpeech(null)
      setSpeakingJudge(null)
      lastSpeechRef.current = null
      lastSpeakingJudgeRef.current = null
      return
    }

    scheduleNextSpeech()

    return () => {
      clearAllTimers()
    }
  }, [allowIdleSpeech, clearAllTimers, isJudging, isPostModalOpen, scheduleNextSpeech])

  return { currentSpeech, speakingJudge }
}
