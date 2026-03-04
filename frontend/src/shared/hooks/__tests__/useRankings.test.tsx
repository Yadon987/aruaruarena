import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError, api } from "../../services/api";
import { useRankings } from "../useRankings";
import { RANKING_POLLING_INTERVAL_MS } from "../../constants/query";

// api モジュールのモック化
vi.mock("../../services/api", () => ({
	api: {
		rankings: {
			list: vi.fn(),
		},
	},
	ApiClientError: class extends Error {
		constructor(
			public message: string,
			public code: string,
			public status: number,
		) {
			super(message);
		}
	},
}));

describe("useRankings", () => {
	let queryClient: QueryClient;
	const rankingsListMock = vi.mocked(api.rankings.list);

	beforeEach(() => {
		queryClient = new QueryClient({
			defaultOptions: {
				queries: {
					retry: false, // テストのタイムアウトを防ぐためリトライ無効化
				},
			},
		});
		vi.clearAllMocks();
	});

	const wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);

	it("useRankings が useQuery を正しく呼び出し、データを返す", async () => {
		// 検証内容: 正常系データ取得
		const mockData = {
			rankings: [{ id: "1", nickname: "test" }],
			total_count: 1,
		};
		rankingsListMock.mockResolvedValue(mockData as any);

		const { result } = renderHook(() => useRankings(10), { wrapper });

		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		expect(result.current.data).toEqual(mockData);
		expect(api.rankings.list).toHaveBeenCalledWith(10);
	});

	it("API エラー時に isError が true になる", async () => {
		// 検証内容: エラーハンドリング
		const error = new ApiClientError("Error", "ERROR_CODE", 500);
		rankingsListMock.mockRejectedValue(error);

		const { result } = renderHook(() => useRankings(), { wrapper });

		await waitFor(() => expect(result.current.isError).toBe(true));

		expect(result.current.error).toBeInstanceOf(ApiClientError);
	});

	// その他の細かい境界値テストやリトライロジックのテストは
	// QueryClientの設定に依存するため、ここでは基本的な挙動を確認する

	it("limitパラメータがAPI呼び出しに正しく渡される", async () => {
		// 検証内容: limitパラメータの伝達
		const mockData = { rankings: [], total_count: 0 };
		rankingsListMock.mockResolvedValue(mockData);

		const limit = 15;
		const { result } = renderHook(() => useRankings(limit), { wrapper });

		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		expect(api.rankings.list).toHaveBeenCalledWith(limit);
	});

	it("異なるlimitでクエリキーが変わる", async () => {
		// 検証内容: limitによるクエリキーの変化（キャッシュ分離）
		const mockData = { rankings: [], total_count: 0 };
		rankingsListMock.mockResolvedValue(mockData);

		const { result: result1 } = renderHook(() => useRankings(10), { wrapper });
		const { result: result2 } = renderHook(() => useRankings(20), { wrapper });

		await waitFor(() => expect(result1.current.isSuccess).toBe(true));
		await waitFor(() => expect(result2.current.isSuccess).toBe(true));

		// 異なるlimitは異なるクエリキーになる
		// (実際の実装ではqueryKeys.rankings.list(limit)が使われる)
		expect(api.rankings.list).toHaveBeenCalledWith(10);
		expect(api.rankings.list).toHaveBeenCalledWith(20);
	});

	describe("polling behavior", () => {
		afterEach(() => {
			vi.clearAllTimers();
			vi.useRealTimers();
		});

		it("polling=trueのとき定期的に再取得される", async () => {
			vi.useFakeTimers({ shouldAdvanceTime: true });
			rankingsListMock.mockResolvedValue({ rankings: [], total_count: 0 } as any);

			const { result } = renderHook(() => useRankings(20, { polling: true }), {
				wrapper,
			});

			await waitFor(() => expect(result.current.isSuccess).toBe(true));
			expect(rankingsListMock).toHaveBeenCalledTimes(1);
			
			// advanceTimersByTimeAsync を使用して非同期処理を解決させる
			await vi.advanceTimersByTimeAsync(RANKING_POLLING_INTERVAL_MS);
			await waitFor(() => expect(rankingsListMock).toHaveBeenCalledTimes(2));
		});

		it("polling=falseのとき一定時間後も1回のみ取得される", async () => {
			vi.useFakeTimers({ shouldAdvanceTime: true });
			rankingsListMock.mockResolvedValue({ rankings: [], total_count: 0 } as any);

			const { result } = renderHook(
				() => useRankings(20, { polling: false }),
				{ wrapper },
			);

			await waitFor(() => expect(result.current.isSuccess).toBe(true));
			
			await vi.advanceTimersByTimeAsync(RANKING_POLLING_INTERVAL_MS * 2);
			expect(rankingsListMock).toHaveBeenCalledTimes(1);
		});
	});

	describe("limit normalization", () => {
		it.each([
			[-5, 1], // 負数値の最小値1への丸め
			[0, 1], // 最小値1への丸め
			[99, 20], // 最大値20への丸め
		])(
			"limit=%i のとき、安全な範囲(%i)に丸めてAPIを呼ぶ",
			async (inputLimit, expectedLimit) => {
				rankingsListMock.mockResolvedValue({
					rankings: [],
					total_count: 0,
				} as any);

				renderHook(() => useRankings(inputLimit), { wrapper });

				await waitFor(() => expect(rankingsListMock).toHaveBeenCalled());
				expect(rankingsListMock).toHaveBeenCalledWith(expectedLimit);
			},
		);

		it.each([Number.NaN, Number.POSITIVE_INFINITY])(
			"limit=%p のときデフォルト値(20)でAPIを呼ぶ",
			async (invalidLimit) => {
				rankingsListMock.mockResolvedValue({
					rankings: [],
					total_count: 0,
				} as any);

				renderHook(() => useRankings(invalidLimit), { wrapper });

				await waitFor(() => expect(rankingsListMock).toHaveBeenCalledTimes(1));
				expect(rankingsListMock).toHaveBeenCalledWith(20);
			},
		);
	});
});
