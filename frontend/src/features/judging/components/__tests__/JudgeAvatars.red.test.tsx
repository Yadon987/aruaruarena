import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("framer-motion", () => ({
	motion: {
		div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
		img: ({ src, alt, ...props }: any) => <img src={src} alt={alt} {...props} />,
	},
	AnimatePresence: ({ children }: any) => <>{children}</>,
}));

const loadJudgeAvatars = async () => {
	return import("../JudgeAvatars");
};

describe("E24-04 RED: JudgeAvatars", () => {
	it("viewMode に関係なくレンダリングされる", async () => {
		// 何を検証するか: FR-01 - 審査員3名が常に背景に表示されること
		const { JudgeAvatars } = await loadJudgeAvatars();
		const { rerender } = render(
			<JudgeAvatars viewMode="top" isJudging={false} isPostModalOpen={false} />,
		);

		expect(screen.getAllByRole("img")).toHaveLength(3);

		rerender(
			<JudgeAvatars
				viewMode="judging"
				isJudging={true}
				isPostModalOpen={false}
			/>,
		);
		expect(screen.getAllByRole("img")).toHaveLength(3);
	});

	it("isJudging=false で口癖が表示されない", async () => {
		// 何を検証するか: 審査中でない場合は吹き出しが表示されないこと
		const { JudgeAvatars } = await loadJudgeAvatars();

		render(
			<JudgeAvatars viewMode="top" isJudging={false} isPostModalOpen={false} />,
		);

		expect(screen.queryByRole("status")).not.toBeInTheDocument();
	});

	it("isJudging=true で口癖が表示される", async () => {
		// 何を検証するか: 審査中は吹き出しが表示されること
		const { JudgeAvatars } = await loadJudgeAvatars();

		render(
			<JudgeAvatars
				viewMode="judging"
				isJudging={true}
				isPostModalOpen={false}
			/>,
		);

		expect(screen.queryByRole("status")).toBeInTheDocument();
	});

	it("横並びレイアウト（flex-row）が適用される", async () => {
		// 何を検証するか: 3人の審査員が横一列に並ぶこと
		const { JudgeAvatars } = await loadJudgeAvatars();

		render(
			<JudgeAvatars viewMode="top" isJudging={false} isPostModalOpen={false} />,
		);

		const container = screen.getByTestId("judge-avatars-container");
		expect(container).toHaveClass("flex-row");
	});

	it("レスポンシブサイズ（w-20 md:w-32）が適用される", async () => {
		// 何を検証するか: NFR-05 - スマホ幅でも適切なサイズで表示されること
		const { JudgeAvatars } = await loadJudgeAvatars();

		render(
			<JudgeAvatars viewMode="top" isJudging={false} isPostModalOpen={false} />,
		);

		const avatars = screen.getAllByRole("img");
		avatars.forEach((avatar) => {
			expect(avatar).toHaveClass("w-20");
			expect(avatar.className).toMatch(/md:w-32/);
		});
	});

	it("3人の審査員のalt属性が正しく設定される", async () => {
		// 何を検証するか: アクセシビリティ - 各審査員の画像にalt属性が設定されること
		const { JudgeAvatars } = await loadJudgeAvatars();

		render(
			<JudgeAvatars viewMode="top" isJudging={false} isPostModalOpen={false} />,
		);

		expect(screen.getByAltText("ひろゆき風審査員")).toBeInTheDocument();
		expect(screen.getByAltText("デヴィ夫人風審査員")).toBeInTheDocument();
		expect(screen.getByAltText("中尾彬風審査員")).toBeInTheDocument();
	});
});
