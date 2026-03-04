import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../mocks/browser", () => ({
	worker: {
		start: () => Promise.resolve(),
		stop: () => Promise.resolve(),
	},
}));

const loadApp = async () => {
	return import("../../../App");
};

describe("E24-07 RED: App Seamless UI Integration", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.clearAllMocks();
	});

	it("初期表示で審査員が背景に表示される", async () => {
		// 何を検証するか: FR-01 - 審査員3名が常に背景に表示されること
		const { default: App } = await loadApp();

		render(<App />);

		const avatars = screen
			.getAllByRole("img")
			.filter((img) => img.getAttribute("alt")?.includes("審査員"));
		expect(avatars).toHaveLength(3);
	});

	it("投稿ボタンでモーダルが開く", async () => {
		// 何を検証するか: FR-04 - 投稿フォームがモーダルとして表示されること
		const { default: App } = await loadApp();

		render(<App />);

		fireEvent.click(screen.getByRole("button", { name: "投稿する" }));

		await waitFor(() => {
			expect(screen.getByRole("dialog")).toBeInTheDocument();
		});
	});

	it("モーダル中は口癖が表示されない", async () => {
		// 何を検証するか: FR-09 - モーダルオープン中は口癖表示を停止すること
		const { default: App } = await loadApp();

		render(<App />);
		fireEvent.click(screen.getByRole("button", { name: "投稿する" }));

		await waitFor(() => {
			expect(screen.getByRole("dialog")).toBeInTheDocument();
		});

		expect(screen.queryByRole("status")).not.toBeInTheDocument();
	});

	it("投稿完了でモーダルが閉じ、審査中になる", async () => {
		// 何を検証するか: FR-05 - 投稿完了時、モーダルが閉じ審査員が口癖発話を開始すること
		const { default: App } = await loadApp();

		render(<App />);
		fireEvent.click(screen.getByRole("button", { name: "投稿する" }));

		await waitFor(() => {
			expect(screen.getByRole("dialog")).toBeInTheDocument();
		});

		fireEvent.change(screen.getByLabelText("ニックネーム"), {
			target: { value: "テスト" },
		});
		fireEvent.change(screen.getByLabelText("あるある"), {
			target: { value: "テスト投稿" },
		});
		fireEvent.click(screen.getByRole("button", { name: "投稿" }));

		await waitFor(() => {
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		});

		await waitFor(() => {
			expect(screen.getByText(/審査中/)).toBeInTheDocument();
		});
	});

	it("審査中に投稿内容（ニックネーム・本文）が表示される", async () => {
		// 何を検証するか: FR-07 - 審査中の投稿内容が画面表示されること
		const { default: App } = await loadApp();

		render(<App />);
		fireEvent.click(screen.getByRole("button", { name: "投稿する" }));
		await waitFor(() => screen.getByRole("dialog"));

		fireEvent.change(screen.getByLabelText("ニックネーム"), {
			target: { value: "テスト太郎" },
		});
		fireEvent.change(screen.getByLabelText("あるある"), {
			target: { value: "テスト本文" },
		});
		fireEvent.click(screen.getByRole("button", { name: "投稿" }));

		await waitFor(() => {
			expect(screen.getByText(/テスト太郎/)).toBeInTheDocument();
			expect(screen.getByText(/テスト本文/)).toBeInTheDocument();
		});
	});

	it("審査中に口癖が表示される", async () => {
		// 何を検証するか: FR-06 - 審査中に口癖発話が表示されること
		const { default: App } = await loadApp();

		render(<App />);
		fireEvent.click(screen.getByRole("button", { name: "投稿する" }));
		await waitFor(() => screen.getByRole("dialog"));

		fireEvent.change(screen.getByLabelText("ニックネーム"), {
			target: { value: "テスト" },
		});
		fireEvent.change(screen.getByLabelText("あるある"), {
			target: { value: "テスト投稿" },
		});
		fireEvent.click(screen.getByRole("button", { name: "投稿" }));

		await waitFor(() => {
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		});

		await act(async () => {
			await vi.advanceTimersByTimeAsync(3000);
		});

		await waitFor(() => {
			expect(screen.getByRole("status")).toBeInTheDocument();
		});
	});

	it("審査完了で結果モーダルが表示される", async () => {
		// 何を検証するか: FR-08 - 審査完了時、結果モーダルが表示されること
		const { default: App } = await loadApp();

		render(<App />);
		fireEvent.click(screen.getByRole("button", { name: "投稿する" }));
		await waitFor(() => screen.getByRole("dialog"));

		fireEvent.change(screen.getByLabelText("ニックネーム"), {
			target: { value: "テスト" },
		});
		fireEvent.change(screen.getByLabelText("あるある"), {
			target: { value: "テスト投稿" },
		});
		fireEvent.click(screen.getByRole("button", { name: "投稿" }));

		await waitFor(() => {
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		});

		await act(async () => {
			await vi.advanceTimersByTimeAsync(5000);
		});

		await waitFor(() => {
			expect(screen.getByRole("dialog", { name: /審査結果/ })).toBeInTheDocument();
		});
	});

	it("結果モーダル表示後、審査員は待機状態に戻る", async () => {
		// 何を検証するか: FR-08 - 審査完了時、審査員は待機状態に戻ること
		const { default: App } = await loadApp();

		render(<App />);
		fireEvent.click(screen.getByRole("button", { name: "投稿する" }));
		await waitFor(() => screen.getByRole("dialog"));

		fireEvent.change(screen.getByLabelText("ニックネーム"), {
			target: { value: "テスト" },
		});
		fireEvent.change(screen.getByLabelText("あるある"), {
			target: { value: "テスト投稿" },
		});
		fireEvent.click(screen.getByRole("button", { name: "投稿" }));

		await waitFor(() => {
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		});

		await act(async () => {
			await vi.advanceTimersByTimeAsync(5000);
		});

		await waitFor(() => {
			expect(screen.getByRole("dialog", { name: /審査結果/ })).toBeInTheDocument();
		});

		expect(screen.queryByRole("status")).not.toBeInTheDocument();
	});
});
