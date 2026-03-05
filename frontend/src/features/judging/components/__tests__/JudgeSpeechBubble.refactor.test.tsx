import { render } from "@testing-library/react";
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

describe("JudgeSpeechBubble Refactor", () => {
	it("AnimatePresence 配下で表示・非表示を切り替えできる", async () => {
		const { JudgeSpeechBubble } = await loadJudgeSpeechBubble();
		const { rerender, queryByText } = render(
			<JudgeSpeechBubble isVisible={true} text="表示" judgeType="hiroyuki" />,
		);

		expect(queryByText("表示")).toBeInTheDocument();

		rerender(<JudgeSpeechBubble isVisible={false} text="表示" judgeType="hiroyuki" />);
		expect(queryByText("表示")).not.toBeInTheDocument();
	});

	it("審査員タイプごとに位置クラスが適用される", async () => {
		const { JudgeSpeechBubble } = await loadJudgeSpeechBubble();

		const dewi = render(
			<JudgeSpeechBubble isVisible={true} text="dewi" judgeType="dewi" />,
		);
		expect(dewi.container.firstChild).toHaveClass("justify-center");
		dewi.unmount();

		const nakao = render(
			<JudgeSpeechBubble isVisible={true} text="nakao" judgeType="nakao" />,
		);
		expect(nakao.container.firstChild).toHaveClass("justify-start");
		nakao.unmount();
	});
});
