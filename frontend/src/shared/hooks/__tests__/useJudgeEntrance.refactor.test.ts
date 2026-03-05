import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useReducedMotionMock = vi.fn();
vi.mock("../useReducedMotion", () => ({
	useReducedMotion: () => useReducedMotionMock(),
}));

const loadUseJudgeEntrance = async () => {
	return import("../useJudgeEntrance");
};

describe("useJudgeEntrance Refactor", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.useFakeTimers();
		useReducedMotionMock.mockReturnValue(false);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.clearAllMocks();
	});

	it("prefersReducedMotion が動的に true へ変わると hasEntered=true になる", async () => {
		const { useJudgeEntrance } = await loadUseJudgeEntrance();
		const { result, rerender } = renderHook(() => useJudgeEntrance());

		expect(result.current.hasEntered).toBe(false);

		useReducedMotionMock.mockReturnValue(true);
		rerender();

		expect(result.current.hasEntered).toBe(true);
	});

	it("複数回のマウント/アンマウントでもタイマーがリークしない", async () => {
		const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
		const { useJudgeEntrance } = await loadUseJudgeEntrance();

		const first = renderHook(() => useJudgeEntrance());
		first.unmount();
		const second = renderHook(() => useJudgeEntrance());
		second.unmount();

		await act(async () => {
			await vi.advanceTimersByTimeAsync(3000);
		});

		expect(clearTimeoutSpy).toHaveBeenCalled();
	});
});
