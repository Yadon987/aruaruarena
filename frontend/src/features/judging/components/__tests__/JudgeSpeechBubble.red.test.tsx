import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("framer-motion", () => ({
	motion: {
		div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
	},
	AnimatePresence: ({ children }: any) => <>{children}</>,
}));

const loadJudgeSpeechBubble = async () => {
	return import("../JudgeSpeechBubble");
};

describe("E24-05 RED: JudgeSpeechBubble", () => {
	it("吹き出しが表示される", async () => {
		// 何を検証するか: isVisible=true のとき吹き出しが表示されること
		const { JudgeSpeechBubble } = await loadJudgeSpeechBubble();

		render(
			<JudgeSpeechBubble
				isVisible={true}
				text="それってあなたの感想ですよね"
				judgeType="hiroyuki"
			/>,
		);

		expect(screen.getByText("それってあなたの感想ですよね")).toBeInTheDocument();
	});

	it("isVisible=false で吹き出しが非表示", async () => {
		// 何を検証するか: isVisible=false のとき吹き出しが表示されないこと
		const { JudgeSpeechBubble } = await loadJudgeSpeechBubble();

		render(
			<JudgeSpeechBubble
				isVisible={false}
				text="それってあなたの感想ですよね"
				judgeType="hiroyuki"
			/>,
		);

		expect(screen.queryByText("それってあなたの感想ですよね")).not.toBeInTheDocument();
	});

	it('aria-live="polite" が設定される', async () => {
		// 何を検証するか: NFR-04 - スクリーンリーダーで口癖が読み上げられること
		const { JudgeSpeechBubble } = await loadJudgeSpeechBubble();

		render(
			<JudgeSpeechBubble
				isVisible={true}
				text="それってあなたの感想ですよね"
				judgeType="hiroyuki"
			/>,
		);

		const bubble = screen.getByRole("status");
		expect(bubble).toHaveAttribute("aria-live", "polite");
	});

	it("複数行テキストが正しく折り返される（whitespace-normal）", async () => {
		// 何を検証するか: 長いセリフが正しく折り返されて表示されること
		const { JudgeSpeechBubble } = await loadJudgeSpeechBubble();
		const longText = "頭の悪い人には分からないかもしれないですけど";

		render(
			<JudgeSpeechBubble isVisible={true} text={longText} judgeType="hiroyuki" />,
		);

		const bubble = screen.getByText(longText);
		expect(bubble).toHaveClass("whitespace-normal");
	});

	it("審査員タイプに応じた位置に表示される", async () => {
		// 何を検証するか: 各審査員の位置に合わせて吹き出しが表示されること
		const { JudgeSpeechBubble } = await loadJudgeSpeechBubble();

		const { container } = render(
			<JudgeSpeechBubble isVisible={true} text="テスト" judgeType="dewi" />,
		);

		const bubbleContainer = container.firstChild;
		expect(bubbleContainer).toHaveClass("justify-center");
	});
});
