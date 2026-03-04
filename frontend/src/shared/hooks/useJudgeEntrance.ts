import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "./useReducedMotion";

const ENTRANCE_DURATION_MS = 1200;

interface JudgeEntranceVariants {
	hiroyuki: {
		initial: { y: number; x: number; opacity: number; scale: number };
		animate: { y: number; x: number; opacity: number; scale: number };
		transition: { type: string; bounce: number; duration: number };
	};
	dewi: {
		initial: { x: number; opacity: number };
		animate: { x: number; opacity: number };
		transition: { duration: number; ease: string };
	};
	nakao: {
		initial: { x: number; opacity: number; scale: number };
		animate: { x: number; opacity: number; scale: number };
		transition: { duration: number; ease: number[] };
	};
}

const JUDGE_ENTRANCE_VARIANTS: JudgeEntranceVariants = {
	hiroyuki: {
		initial: { y: 100, x: -30, opacity: 0, scale: 0.8 },
		animate: { y: 0, x: 0, opacity: 1, scale: 1 },
		transition: { type: "spring", bounce: 0.4, duration: 0.8 },
	},
	dewi: {
		initial: { x: 200, opacity: 0 },
		animate: { x: 0, opacity: 1 },
		transition: { duration: 1.0, ease: "easeOut" },
	},
	nakao: {
		initial: { x: -200, opacity: 0, scale: 0.9 },
		animate: { x: 0, opacity: 1, scale: 1 },
		transition: { duration: 1.2, ease: [0.25, 0.1, 0.25, 1] },
	},
};

interface JudgeEntranceState {
	hasEntered: boolean;
	variants: JudgeEntranceVariants;
}

export function useJudgeEntrance(): JudgeEntranceState {
	const prefersReducedMotion = useReducedMotion();
	const [hasEntered, setHasEntered] = useState(prefersReducedMotion);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (prefersReducedMotion) {
			setHasEntered(true);
			return;
		}

		timerRef.current = setTimeout(() => {
			setHasEntered(true);
		}, ENTRANCE_DURATION_MS);

		return () => {
			if (timerRef.current) {
				clearTimeout(timerRef.current);
			}
		};
	}, [prefersReducedMotion]);

	return { hasEntered, variants: JUDGE_ENTRANCE_VARIANTS };
}
