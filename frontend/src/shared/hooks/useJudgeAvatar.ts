import { useEffect, useRef, useState } from "react";
import {
	AVATAR_ANIMATION,
	type AvatarState,
	getAvatarImagePath,
} from "../constants/avatar.ts";
import type { JudgePersona } from "../types/domain.ts";

import { useReducedMotion } from "./useReducedMotion.ts";

interface JudgeAvatarState {
	/** 現在の画像パス */
	currentImage: string;
	/** 現在のアバター状態 */
	currentState: AvatarState;
}

/**
 * 審査員アバターのアニメーションを制御する
 *
 * @param persona 審査員ペルソナ
 * @param isSpeaking 発話中フラグ
 * @returns アバター状態
 */
export function useJudgeAvatar(
	persona: JudgePersona,
	isSpeaking: boolean,
): JudgeAvatarState {
	const prefersReducedMotion = useReducedMotion();
	const [currentState, setCurrentState] = useState<AvatarState>("base");
	const blinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const blinkEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const mouthStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const mouthEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (prefersReducedMotion) {
			setCurrentState((previousState) =>
				previousState === "eye_closed" ? "base" : previousState,
			);
			return;
		}

		const scheduleBlink = () => {
			blinkTimerRef.current = setTimeout(() => {
				setCurrentState("eye_closed");

				blinkEndTimerRef.current = setTimeout(() => {
					setCurrentState((previousState) =>
						previousState === "eye_closed" ? "base" : previousState,
					);
					scheduleBlink();
				}, AVATAR_ANIMATION.BLINK_DURATION_MS);
			}, AVATAR_ANIMATION.BLINK_INTERVAL_MIN_MS);
		};

		scheduleBlink();

		return () => {
			if (blinkTimerRef.current) {
				clearTimeout(blinkTimerRef.current);
			}

			if (blinkEndTimerRef.current) {
				clearTimeout(blinkEndTimerRef.current);
			}
		};
	}, [prefersReducedMotion]);

	useEffect(() => {
		if (prefersReducedMotion || !isSpeaking) {
			setCurrentState((previousState) =>
				previousState === "mouth_open" ? "base" : previousState,
			);
			return;
		}

		const scheduleMouth = () => {
			mouthStartTimerRef.current = setTimeout(() => {
				setCurrentState((previousState) =>
					previousState === "eye_closed" ? previousState : "mouth_open",
				);

				mouthEndTimerRef.current = setTimeout(() => {
					setCurrentState((previousState) =>
						previousState === "mouth_open" ? "base" : previousState,
					);
					scheduleMouth();
				}, AVATAR_ANIMATION.MOUTH_DURATION_MS);
			}, AVATAR_ANIMATION.MOUTH_INTERVAL_MIN_MS);
		};

		scheduleMouth();

		return () => {
			if (mouthStartTimerRef.current) {
				clearTimeout(mouthStartTimerRef.current);
			}

			if (mouthEndTimerRef.current) {
				clearTimeout(mouthEndTimerRef.current);
			}
		};
	}, [prefersReducedMotion, isSpeaking]);

	return {
		currentImage: getAvatarImagePath(persona, currentState),
		currentState,
	};
}
