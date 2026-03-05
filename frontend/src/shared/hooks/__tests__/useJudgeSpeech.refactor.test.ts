import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loadUseJudgeSpeech = async () => {
	return import("../useJudgeSpeech");
};

describe("useJudgeSpeech Refactor", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.clearAllMocks();
	});

	it("isJudging: true -> false -> true で発話を再開できる", async () => {
		const { useJudgeSpeech } = await loadUseJudgeSpeech();
		const { result, rerender } = renderHook(
			({ isJudging, isPostModalOpen }) =>
				useJudgeSpeech({ isJudging, isPostModalOpen }),
			{ initialProps: { isJudging: true, isPostModalOpen: false } },
		);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(6000);
		});
		expect(result.current.currentSpeech).not.toBeNull();

		rerender({ isJudging: false, isPostModalOpen: false });
		expect(result.current.currentSpeech).toBeNull();

		rerender({ isJudging: true, isPostModalOpen: false });
		await act(async () => {
			await vi.advanceTimersByTimeAsync(6000);
		});
		expect(result.current.currentSpeech).not.toBeNull();
	});

	it("口癖配列が1件でもクラッシュせず発話できる", async () => {
		vi.doMock("../../constants/judgePhrases", () => ({
			JUDGES: ["hiroyuki", "dewi", "nakao"],
			JUDGE_PHRASES: {
				hiroyuki: ["A"],
				dewi: ["B"],
				nakao: ["C"],
			},
		}));

		const { useJudgeSpeech } = await import("../useJudgeSpeech");
		const { result } = renderHook(() =>
			useJudgeSpeech({ isJudging: true, isPostModalOpen: false }),
		);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(6000);
		});

		expect(["A", "B", "C"]).toContain(result.current.currentSpeech);
	});

	it("発話間隔は最小4000ms〜最大6000msの範囲内になる", async () => {
		const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
		const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.4);
		const { useJudgeSpeech } = await loadUseJudgeSpeech();

		renderHook(() => useJudgeSpeech({ isJudging: true, isPostModalOpen: false }));

		expect(setTimeoutSpy.mock.calls.length).toBeGreaterThan(0);
		expect(setTimeoutSpy.mock.calls[0]).toBeDefined();
		expect(setTimeoutSpy.mock.calls[0][1]).toBeDefined();
		const firstDelay = setTimeoutSpy.mock.calls[0][1] as number;
		expect(typeof firstDelay).toBe("number");
		expect(firstDelay).toBeGreaterThanOrEqual(4000);
		expect(firstDelay).toBeLessThanOrEqual(6000);

		randomSpy.mockRestore();
	});

	it("全審査員からランダム選択される", async () => {
		const { useJudgeSpeech } = await loadUseJudgeSpeech();
		const { result } = renderHook(() =>
			useJudgeSpeech({ isJudging: true, isPostModalOpen: false }),
		);
		const picked = new Set<string>();

		for (let i = 0; i < 120; i += 1) {
			await act(async () => {
				await vi.advanceTimersByTimeAsync(10000);
			});
			if (result.current.speakingJudge) {
				picked.add(result.current.speakingJudge);
			}
		}

		expect(picked).toEqual(new Set(["hiroyuki", "dewi", "nakao"]));
	});
});
