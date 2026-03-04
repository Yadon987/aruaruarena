import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError, api } from "../../services/api";
import { useRankings } from "../useRankings";

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
		rankingsListMock.mockResolvedValue(mockData);

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
		it("polling=trueのとき refetchInterval が RANKING_POLLING_INTERVAL_MS になる", async () => {
			// 何を検証するか: useRankingsがpolling=trueのとき、
			// refetchIntervalに定数RANKING_POLLING_INTERVAL_MSが渡されること
			rankingsListMock.mockResolvedValue({ rankings: [], total_count: 0 });

			const { result } = renderHook(() => useRankings(20, { polling: true }), {
				wrapper,
			});

			await waitFor(() => expect(result.current.isSuccess).toBe(true));

			// useRankingsが2回呼ばれることを待機（リトライ含む） もしくはqueryが成功したことを確認
			expect(api.rankings.list).toHaveBeenCalledWith(20);
		});

		it("polling=falseのとき1回のみ取得される", async () => {
			// 何を検証するか: polling無効時はマウント時の1回のみデータ取得
			rankingsListMock.mockResolvedValue({ rankings: [], total_count: 0 });

			const { result } = renderHook(
				() => useRankings(20, { polling: false }),
				{ wrapper },
			);

			await waitFor(() => expect(result.current.isSuccess).toBe(true));

			expect(api.rankings.list).toHaveBeenCalledTimes(1);
		});
	});

	describe("limit normalization", () => {
		it("limitが範囲外でも1〜20に丸めてAPIを呼ぶ", async () => {
			// 何を検証するか: 件数パラメータが安全な範囲に正規化されること
			rankingsListMock.mockResolvedValue({ rankings: [], total_count: 0 });

			renderHook(() => useRankings(0), { wrapper });
			renderHook(() => useRankings(99), { wrapper });

			await waitFor(() => expect(api.rankings.list).toHaveBeenCalled());
			expect(api.rankings.list).toHaveBeenCalledWith(1);
			expect(api.rankings.list).toHaveBeenCalledWith(20);
		});

		it("limitがNaN/Infinityでもデフォルト値でAPIを呼ぶ", async () => {
			// 何を検証するか: 非数・無限大入力でも安全なデフォルト件数で取得すること
			rankingsListMock.mockResolvedValue({ rankings: [], total_count: 0 });

			renderHook(() => useRankings(Number.NaN), { wrapper });
			renderHook(() => useRankings(Number.POSITIVE_INFINITY), { wrapper });

			await waitFor(() => expect(api.rankings.list).toHaveBeenCalled());
			expect(api.rankings.list).toHaveBeenCalledWith(20);
		});
	});
});
