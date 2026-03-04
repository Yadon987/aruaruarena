import { useReducedMotion } from "./useReducedMotion";

interface JudgeBreathingVariants {
	hiroyuki: {
		keyframes: { scale: number[] };
		transition: { duration: number; repeat: number; ease: string };
	};
	dewi: {
		keyframes: { scale: number[]; y: number[] };
		transition: { duration: number; repeat: number; ease: string };
	};
	nakao: {
		keyframes: { scale: number[] };
		transition: { duration: number; repeat: number; ease: string };
	};
}

const JUDGE_BREATHING_VARIANTS: JudgeBreathingVariants = {
	hiroyuki: {
		keyframes: { scale: [1, 1.02, 1] },
		transition: { duration: 2.0, repeat: Infinity, ease: "easeInOut" },
	},
	dewi: {
		keyframes: { scale: [1, 1.05, 1], y: [0, -3, 0] },
		transition: { duration: 4.0, repeat: Infinity, ease: "easeInOut" },
	},
	nakao: {
		keyframes: { scale: [1, 1.01, 1] },
		transition: { duration: 5.0, repeat: Infinity, ease: "easeInOut" },
	},
};

interface JudgeBreathingState {
	isBreathing: boolean;
	variants: JudgeBreathingVariants;
}

interface UseJudgeBreathingOptions {
	hasEntered: boolean;
	isSpeaking: boolean;
}

export function useJudgeBreathing({
	hasEntered,
	isSpeaking,
}: UseJudgeBreathingOptions): JudgeBreathingState {
	const prefersReducedMotion = useReducedMotion();
	const isBreathing = hasEntered && !isSpeaking && !prefersReducedMotion;

	return { isBreathing, variants: JUDGE_BREATHING_VARIANTS };
}
