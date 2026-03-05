import { JUDGE_BREATHING } from "../constants/animations";
import { useReducedMotion } from "./useReducedMotion";

type JudgeBreathingVariants = typeof JUDGE_BREATHING.VARIANTS;

interface JudgeBreathingState {
	isBreathing: boolean;
	variants: JudgeBreathingVariants;
}

interface UseJudgeBreathingOptions {
	hasEntered: boolean;
	isSpeaking: boolean;
}

/**
 * 審査員呼吸アニメーションを制御するフック
 */
export function useJudgeBreathing({
	hasEntered,
	isSpeaking,
}: UseJudgeBreathingOptions): JudgeBreathingState {
	const prefersReducedMotion = useReducedMotion();
	const isBreathing = hasEntered && !isSpeaking && !prefersReducedMotion;
	const variants = JUDGE_BREATHING.VARIANTS;

	return { isBreathing, variants };
}
