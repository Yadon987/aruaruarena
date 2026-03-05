import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("framer-motion", () => ({
	motion: {
		div: (
			{
				children,
				initial,
				animate,
				exit,
				variants,
				transition,
				whileHover,
				whileTap,
				...props
			}: any,
		) => <div {...props}>{children}</div>,
	},
	AnimatePresence: ({ children }: any) => <>{children}</>,
}));

const loadPostFormModal = async () => {
	return import("../PostFormModal");
};

describe("PostFormModal Refactor", () => {
	it("モーダルオープン時に閉じるボタンへフォーカスする", async () => {
		const { PostFormModal } = await loadPostFormModal();

		render(
			<PostFormModal
				isOpen={true}
				onClose={vi.fn()}
				onSubmit={vi.fn()}
				isLoading={false}
			/>,
		);

		expect(screen.getByRole("button", { name: "閉じる" })).toHaveFocus();
	});

	it("Tab でフォーカスが最後から最初へ循環する", async () => {
		const { PostFormModal } = await loadPostFormModal();

		render(
			<PostFormModal
				isOpen={true}
				onClose={vi.fn()}
				onSubmit={vi.fn()}
				isLoading={false}
			/>,
		);

		const first = screen.getByRole("button", { name: "閉じる" });
		const last = screen.getByRole("button", { name: "投稿" });
		last.focus();
		fireEvent.keyDown(document, { key: "Tab" });

		expect(first).toHaveFocus();
	});

	it("Shift+Tab でフォーカスが最初から最後へ循環する", async () => {
		const { PostFormModal } = await loadPostFormModal();

		render(
			<PostFormModal
				isOpen={true}
				onClose={vi.fn()}
				onSubmit={vi.fn()}
				isLoading={false}
			/>,
		);

		const first = screen.getByRole("button", { name: "閉じる" });
		const last = screen.getByRole("button", { name: "投稿" });
		first.focus();
		fireEvent.keyDown(document, { key: "Tab", shiftKey: true });

		expect(last).toHaveFocus();
	});
});
