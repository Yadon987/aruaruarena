import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../../App";
import { JUDGE_LABELS } from "../../../shared/constants/avatar";
import { JUDGE } from "../../../shared/constants/validation";
import { api } from "../../../shared/services/api";

vi.mock("@tanstack/react-query-devtools", () => ({
	ReactQueryDevtools: () => <div data-testid="react-query-devtools" />,
}));

describe("E23-01 RED: 審査中画面のアバター統合", () => {
	beforeEach(() => {
		localStorage.clear();
		vi.clearAllMocks();
	});

	async function submitValidPost() {
		fireEvent.change(screen.getByLabelText("ニックネーム"), {
			target: { value: "太郎" },
		});
		fireEvent.change(screen.getByLabelText("あるある本文"), {
			target: { value: "スヌーズ押して二度寝" },
		});
		fireEvent.click(screen.getByRole("button", { name: "投稿する" }));

		await waitFor(() => {
			expect(api.posts.create).toHaveBeenCalledTimes(1);
		});
	}

	it("審査中画面に3人のアバター画像が表示される", async () => {
		vi.spyOn(api.posts, "create").mockResolvedValue({
			id: "judge-avatar-red-1",
			status: "judging",
		});
		vi.spyOn(api.posts, "get").mockResolvedValue({
			id: "judge-avatar-red-1",
			nickname: "太郎",
			body: "スヌーズ押して二度寝",
			status: "judging",
			created_at: "2026-03-04T00:00:00Z",
			judgments: [],
		});

		render(<App />);
		await submitValidPost();

		await screen.findByTestId("judging-screen");

		for (const persona of JUDGE.PERSONAS) {
			expect(
				screen.getByRole("img", {
					name: `${JUDGE_LABELS[persona]}の審査員アバター`,
				}),
			).toBeInTheDocument();
		}
	});

	it("ひろゆきのキャッチフレーズがアバター画像と一緒に表示される", async () => {
		vi.spyOn(api.posts, "create").mockResolvedValue({
			id: "judge-avatar-red-2",
			status: "judging",
		});
		vi.spyOn(api.posts, "get").mockResolvedValue({
			id: "judge-avatar-red-2",
			nickname: "太郎",
			body: "電車で降りる駅を寝過ごす",
			status: "judging",
			created_at: "2026-03-04T00:00:00Z",
			judgments: [],
		});

		render(<App />);
		await submitValidPost();

		const catchphrase = await screen.findByTestId("catchphrase-hiroyuki");
		const judgeItem = catchphrase.closest("li");

		expect(judgeItem).not.toBeNull();
		expect(
			within(judgeItem as HTMLLIElement).getByRole("img", {
				name: `${JUDGE_LABELS.hiroyuki}の審査員アバター`,
			}),
		).toBeInTheDocument();
	});
});
