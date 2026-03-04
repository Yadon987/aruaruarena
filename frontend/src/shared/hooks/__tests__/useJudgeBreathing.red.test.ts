import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useReducedMotionMock = vi.fn();
vi.mock("../useReducedMotion", () => ({
	useReducedMotion: () => useReducedMotionMock(),
}));

const loadUseJudgeBreathing = async () => {
	return import("../useJudgeBreathing");
};

describe("E24-02 RED: useJudgeBreathing", () => {
	beforeEach(() => {
		vi.resetModules();
		useReducedMotionMock.mockReturnValue(false);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("hasEntered=true かつ isSpeaking=false で isBreathing=true", async () => {
		// 何を検証するか: 登場完了後かつ発話中でない場合に呼吸アニメーションが有効になること
		const { useJudgeBreathing } = await loadUseJudgeBreathing();
		const { result } = renderHook(() =>
			useJudgeBreathing({ hasEntered: true, isSpeaking: false }),
		);

		expect(result.current.isBreathing).toBe(true);
	});

	it("hasEntered=false で isBreathing=false", async () => {
		// 何を検証するか: 登場前は呼吸アニメーションしないこと
		const { useJudgeBreathing } = await loadUseJudgeBreathing();
		const { result } = renderHook(() =>
			useJudgeBreathing({ hasEntered: false, isSpeaking: false }),
		);

		expect(result.current.isBreathing).toBe(false);
	});

	it("isSpeaking=true で isBreathing=false（口パク優先）", async () => {
		// 何を検証するか: 発話中は呼吸アニメーションを停止すること
		const { useJudgeBreathing } = await loadUseJudgeBreathing();
		const { result } = renderHook(() =>
			useJudgeBreathing({ hasEntered: true, isSpeaking: true }),
		);

		expect(result.current.isBreathing).toBe(false);
	});

	it("Reduced Motion 時は isBreathing=false", async () => {
		// 何を検証するか: アクセシビリティ対応としてアニメーション無効時は呼吸しないこと
		useReducedMotionMock.mockReturnValue(true);

		const { useJudgeBreathing } = await loadUseJudgeBreathing();
		const { result } = renderHook(() =>
			useJudgeBreathing({ hasEntered: true, isSpeaking: false }),
		);

		expect(result.current.isBreathing).toBe(false);
	});

	it("各審査員の呼吸アニメーション設定が返される", async () => {
		// 何を検証するか: hiroyuki/dewi/nakao の各呼吸設定が返されること
		const { useJudgeBreathing } = await loadUseJudgeBreathing();
		const { result } = renderHook(() =>
			useJudgeBreathing({ hasEntered: true, isSpeaking: false }),
		);

		expect(result.current.variants).toHaveProperty("hiroyuki");
		expect(result.current.variants).toHaveProperty("dewi");
		expect(result.current.variants).toHaveProperty("nakao");
		expect(result.current.variants.hiroyuki.transition.duration).toBe(2.0);
		expect(result.current.variants.dewi.transition.duration).toBe(4.0);
		expect(result.current.variants.nakao.transition.duration).toBe(5.0);
	});
});
