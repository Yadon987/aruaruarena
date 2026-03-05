import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useReducedMotionMock = vi.fn();
vi.mock("../useReducedMotion", () => ({
	useReducedMotion: () => useReducedMotionMock(),
}));

const loadUseJudgeBreathing = async () => {
	return import("../useJudgeBreathing");
};

describe("useJudgeBreathing Refactor", () => {
	beforeEach(() => {
		vi.resetModules();
		useReducedMotionMock.mockReturnValue(false);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("hasEntered/isSpeaking の変更に追従して isBreathing が更新される", async () => {
		const { useJudgeBreathing } = await loadUseJudgeBreathing();
		const { result, rerender } = renderHook(
			({ hasEntered, isSpeaking }) => useJudgeBreathing({ hasEntered, isSpeaking }),
			{ initialProps: { hasEntered: false, isSpeaking: false } },
		);

		expect(result.current.isBreathing).toBe(false);

		rerender({ hasEntered: true, isSpeaking: false });
		expect(result.current.isBreathing).toBe(true);

		rerender({ hasEntered: true, isSpeaking: true });
		expect(result.current.isBreathing).toBe(false);
	});

	it("条件がすべて false に変化しても正しく停止する", async () => {
		const { useJudgeBreathing } = await loadUseJudgeBreathing();
		const { result, rerender } = renderHook(
			({ hasEntered, isSpeaking }) => useJudgeBreathing({ hasEntered, isSpeaking }),
			{ initialProps: { hasEntered: true, isSpeaking: false } },
		);

		expect(result.current.isBreathing).toBe(true);

		rerender({ hasEntered: false, isSpeaking: true });
		expect(result.current.isBreathing).toBe(false);
	});
});
