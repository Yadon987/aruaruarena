import { useEffect, useRef, useState } from "react";

const SPEECH_INTERVAL_MIN = 4000;
const SPEECH_INTERVAL_MAX = 6000;
const SPEECH_DURATION_MS = 2500;

type JudgeType = "hiroyuki" | "dewi" | "nakao";
const JUDGES: readonly JudgeType[] = ["hiroyuki", "dewi", "nakao"];

const JUDGE_PHRASES: Record<JudgeType, string[]> = {
	hiroyuki: [
		"なんか、そういうデータあるんですか？",
		"嘘つくのやめてもらっていいですか？",
		"なんだろう……",
		"無理じゃないですか？",
		"頭の悪い人には分からないかもしれないですけど",
		"それってあなたの感想ですよね",
		"僕はさっきから、事実の話をしてるんですよ",
		"はい、論破",
	],
	dewi: [
		"わたくし、嘘は大嫌いですの",
		"何ですって！？",
		"あら、素敵じゃない",
		"本物を見極める力が必要なんですのよ",
		"そんなこと、わたくしには通用いたしませんざます",
		"わたくしの社交界では……",
		"お里が知れますわよ",
		"オ〜ッホッホッホ！",
		"フンッ",
		"まあ……",
	],
	nakao: [
		"なんだよ...",
		"ふむ...",
		"悪くないね",
		"ほう...",
		"粋だねぇ",
		"野暮だよ",
		"本物だね",
		"なんだい？",
		"いいじゃない",
		"なかなか良いじゃねぇか",
		"理屈じゃないんだよ",
		"お前さぁ……",
		"やめなよ",
		"ふんっ",
	],
};

interface UseJudgeSpeechOptions {
	isJudging: boolean;
	isPostModalOpen: boolean;
}

interface JudgeSpeechState {
	currentSpeech: string | null;
	speakingJudge: JudgeType | null;
}

export function useJudgeSpeech({
	isJudging,
	isPostModalOpen,
}: UseJudgeSpeechOptions): JudgeSpeechState {
	const [currentSpeech, setCurrentSpeech] = useState<string | null>(null);
	const [speakingJudge, setSpeakingJudge] = useState<JudgeType | null>(null);
	const intervalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const durationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const lastSpeechRef = useRef<string | null>(null);
	useEffect(() => {
		const clearAllTimers = () => {
			if (intervalTimerRef.current) {
				clearTimeout(intervalTimerRef.current);
				intervalTimerRef.current = null;
			}
			if (durationTimerRef.current) {
				clearTimeout(durationTimerRef.current);
				durationTimerRef.current = null;
			}
		};

		const getRandomInterval = (): number =>
			SPEECH_INTERVAL_MIN +
			Math.random() * (SPEECH_INTERVAL_MAX - SPEECH_INTERVAL_MIN);

		const getRandomJudge = (): JudgeType => {
			return JUDGES[Math.floor(Math.random() * JUDGES.length)];
		};

		const getRandomSpeech = (judge: JudgeType): string => {
			const phrases = JUDGE_PHRASES[judge];
			const availablePhrases = phrases.filter(
				(phrase) => phrase !== lastSpeechRef.current,
			);
			const pool = availablePhrases.length > 0 ? availablePhrases : phrases;
			const speech = pool[Math.floor(Math.random() * pool.length)];
			lastSpeechRef.current = speech;
			return speech;
		};

		const scheduleNextSpeech = () => {
			intervalTimerRef.current = setTimeout(() => {
				const judge = getRandomJudge();
				const speech = getRandomSpeech(judge);
				setSpeakingJudge(judge);
				setCurrentSpeech(speech);

				durationTimerRef.current = setTimeout(() => {
					setCurrentSpeech(null);
					setSpeakingJudge(null);
					scheduleNextSpeech();
				}, SPEECH_DURATION_MS);
			}, getRandomInterval());
		};

		if (!isJudging || isPostModalOpen) {
			clearAllTimers();
			setCurrentSpeech(null);
			setSpeakingJudge(null);
			lastSpeechRef.current = null;
			return;
		}

		scheduleNextSpeech();

		return () => {
			clearAllTimers();
		};
	}, [isJudging, isPostModalOpen]);

	return { currentSpeech, speakingJudge };
}
