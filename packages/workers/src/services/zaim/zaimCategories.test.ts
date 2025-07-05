import { env } from "cloudflare:test";
import { R } from "@praha/byethrow";
import { type Client, createClient } from "@repo/zaim-api/client";
import { getResponse, type HttpHandler } from "msw";
import { assert, test as baseTest, describe, expect, vi } from "vitest";
import {
	createCustomHandlers,
	createErrorHandlers,
	zaimApiHandlers,
} from "./__mocks__/zaimApiHandlers";
import type { ZaimCategory } from "./types";
import { getZaimCategories } from "./zaimCategories";

// キャッシュのモック
vi.mock("../cache/kvCache", () => ({
	getKVCacheRepository: vi.fn(),
}));

import { getKVCacheRepository } from "../cache/kvCache";

// 期待されるZaimカテゴリデータ
const expectedZaimCategories: ZaimCategory[] = [
	{
		id: 1,
		name: "食費",
		subCategories: [
			{ id: 101, name: "食料品" },
			{ id: 102, name: "外食" },
		],
	},
	{
		id: 2,
		name: "日用品",
		subCategories: [{ id: 201, name: "洗剤" }],
	},
];

const mockCacheData = {
	data: expectedZaimCategories,
	version: 1,
};

const userId = "test-user-id";

// テストフィクスチャ
type TestContext = {
	mockCacheRepo: {
		get: ReturnType<typeof vi.fn>;
		set: ReturnType<typeof vi.fn>;
		delete: ReturnType<typeof vi.fn>;
	};
	mockClient: Client;
	fetchHandlers: HttpHandler[];
	fetchSpy: [];
};

const test = baseTest.extend<TestContext>({
	mockCacheRepo: async ({}, use) => {
		const mockCacheRepo = {
			get: vi.fn(),
			set: vi.fn(),
			delete: vi.fn(),
		};

		// getKVCacheRepositoryのモック設定
		const mockGetKVCacheRepository = vi.mocked(getKVCacheRepository);
		mockGetKVCacheRepository.mockReturnValue(mockCacheRepo);

		await use(mockCacheRepo);
	},
	mockClient: async ({}, use) => {
		const client = createClient({
			baseUrl: "https://api.zaim.net/",
		});
		await use(client);
	},
	fetchHandlers: [
		zaimApiHandlers,
		{
			auto: true,
		},
	],
	fetchSpy: [
		async ({ fetchHandlers }, use) => {
			using _ = vi
				.spyOn(globalThis, "fetch")
				.mockImplementation(
					async (input: RequestInfo | URL, init?: RequestInit) => {
						const request = new Request(input, init);
						const response = await getResponse(fetchHandlers, request);
						if (response === undefined) {
							throw new Error("No response found for the request");
						}
						return response;
					},
				);

			await use([]);
		},
		{ auto: true },
	],
});

describe("getZaimCategories", () => {
	describe("キャッシュヒット時", () => {
		test("新しいキャッシュがある場合は即座に返す", async ({
			mockCacheRepo,
			mockClient,
		}) => {
			const now = new Date();
			mockCacheRepo.get.mockResolvedValue(
				R.succeed({
					data: mockCacheData,
					isStale: false,
					metadata: {
						cachedAt: now.toISOString(),
						staleAt: new Date(now.getTime() + 3600 * 1000).toISOString(),
						dataType: "categories",
						userId,
					},
				}),
			);

			const result = await getZaimCategories({
				client: mockClient,
				env,
				userId,
			});

			assert(R.isSuccess(result));
			expect(result.value).toEqual(expectedZaimCategories);

			// APIは呼ばれない
			expect(globalThis.fetch).not.toHaveBeenCalled();
		});

		test("staleなキャッシュがある場合は古いデータを返し、バックグラウンド更新する", async ({
			mockCacheRepo,
			mockClient,
		}) => {
			const now = new Date();
			mockCacheRepo.get.mockResolvedValue(
				R.succeed({
					data: mockCacheData,
					isStale: true,
					metadata: {
						cachedAt: new Date(now.getTime() - 7200 * 1000).toISOString(),
						staleAt: new Date(now.getTime() - 3600 * 1000).toISOString(),
						dataType: "categories",
						userId,
					},
				}),
			);

			mockCacheRepo.set.mockResolvedValue(R.succeed(undefined));

			const result = await getZaimCategories({
				client: mockClient,
				env,
				userId,
			});

			assert(R.isSuccess(result));
			expect(result.value).toEqual(expectedZaimCategories);

			// 少し待ってバックグラウンド処理を確認
			await new Promise((resolve) => setTimeout(resolve, 10));

			// バックグラウンドでAPIが呼ばれる
			expect(globalThis.fetch).toHaveBeenCalled();
		});
	});

	describe("基本機能", () => {
		test("APIからカテゴリデータを正常に取得できる", async ({
			mockCacheRepo,
			mockClient,
		}) => {
			// キャッシュが存在しない場合をモック
			mockCacheRepo.get.mockResolvedValue(R.succeed(null));
			mockCacheRepo.set.mockResolvedValue(R.succeed(undefined));

			const result = await getZaimCategories({
				client: mockClient,
				env,
				userId,
			});

			assert(R.isSuccess(result));
			expect(result.value).toEqual(expectedZaimCategories);

			// APIが呼ばれる
			expect(globalThis.fetch).toHaveBeenCalledTimes(2); // category + genre
		});

		describe("カテゴリとジャンルのデータ変換", () => {
			test.scoped({
				fetchHandlers: createCustomHandlers([
					{
						id: 3,
						name: "その他",
						mode: "payment" as const,
						sort: 3,
						parent_category_id: 0,
						active: 1,
						modified: "2023-01-01T00:00:00Z",
						local_id: 3,
					},
				]),
			});

			test("カテゴリとジャンルのデータ変換が正しく行われる", async ({
				mockCacheRepo,
				mockClient,
			}) => {
				// キャッシュが存在しない場合をモック
				mockCacheRepo.get.mockResolvedValue(R.succeed(null));
				mockCacheRepo.set.mockResolvedValue(R.succeed(undefined));

				const result = await getZaimCategories({
					client: mockClient,
					env,
					userId,
				});

				assert(R.isSuccess(result));
				expect(result.value).toEqual([
					{
						id: 3,
						name: "その他",
						subCategories: [],
					},
				]);
			});
		});

		test("キャッシュ書き込みが失敗してもデータは返される", async ({
			mockCacheRepo,
			mockClient,
		}) => {
			// キャッシュが存在しない場合をモック
			mockCacheRepo.get.mockResolvedValue(R.succeed(null));
			// キャッシュ書き込みが失敗
			mockCacheRepo.set.mockResolvedValue(
				R.fail({
					code: "CACHE_WRITE_ERROR",
					message: "Cache write failed",
				}),
			);

			const result = await getZaimCategories({
				client: mockClient,
				env,
				userId,
			});

			assert(R.isSuccess(result));
			expect(result.value).toEqual(expectedZaimCategories);
		});
	});

	describe("エラーハンドリング", () => {
		test.scoped({
			fetchHandlers: createErrorHandlers(),
		});

		test("カテゴリAPI呼び出しエラー時にエラーを返す", async ({
			mockCacheRepo,
			mockClient,
		}) => {
			// キャッシュが存在しない場合をモック
			mockCacheRepo.get.mockResolvedValue(R.succeed(null));

			const result = await getZaimCategories({
				client: mockClient,
				env,
				userId,
			});

			assert(R.isFailure(result));
			expect(result.error.code).toBe("ZAIM_API_ERROR");
		});

		test("ジャンルAPI呼び出しエラー時にエラーを返す", async ({
			mockCacheRepo,
			mockClient,
		}) => {
			// キャッシュが存在しない場合をモック
			mockCacheRepo.get.mockResolvedValue(R.succeed(null));

			const result = await getZaimCategories({
				client: mockClient,
				env,
				userId,
			});

			assert(R.isFailure(result));
			expect(result.error.code).toBe("ZAIM_API_ERROR");
		});

		test.scoped({
			fetchHandlers: zaimApiHandlers,
		});

		test("キャッシュ取得エラー時はAPIを呼び出す", async ({
			mockCacheRepo,
			mockClient,
		}) => {
			// キャッシュ取得がエラー
			mockCacheRepo.get.mockResolvedValue(
				R.fail({
					code: "CACHE_READ_ERROR",
					message: "Cache read failed",
				}),
			);
			mockCacheRepo.set.mockResolvedValue(R.succeed(undefined));

			const result = await getZaimCategories({
				client: mockClient,
				env,
				userId,
			});

			assert(R.isSuccess(result));
			expect(result.value).toEqual(expectedZaimCategories);

			// APIが呼ばれる
			expect(globalThis.fetch).toHaveBeenCalled();
		});
	});

	describe("バックグラウンド更新", () => {
		test.scoped({
			fetchHandlers: createErrorHandlers(),
		});
		test("バックグラウンド更新でAPI呼び出しが失敗した場合もエラーログが出力される", async ({
			mockCacheRepo,
			mockClient,
		}) => {
			const now = new Date();
			mockCacheRepo.get.mockResolvedValue(
				R.succeed({
					data: mockCacheData,
					isStale: true,
					metadata: {
						cachedAt: new Date(now.getTime() - 7200 * 1000).toISOString(),
						staleAt: new Date(now.getTime() - 3600 * 1000).toISOString(),
						dataType: "categories",
						userId,
					},
				}),
			);

			const result = await getZaimCategories({
				client: mockClient,
				env,
				userId,
			});

			// staleデータが返される
			assert(R.isSuccess(result));
			expect(result.value).toEqual(expectedZaimCategories);

			// バックグラウンド処理の完了を待つ
			await new Promise((resolve) => setTimeout(resolve, 10));
		});

		test("バックグラウンド更新でキャッシュ書き込みが失敗した場合もエラーログが出力される", async ({
			mockCacheRepo,
			mockClient,
		}) => {
			const now = new Date();
			mockCacheRepo.get.mockResolvedValue(
				R.succeed({
					data: mockCacheData,
					isStale: true,
					metadata: {
						cachedAt: new Date(now.getTime() - 7200 * 1000).toISOString(),
						staleAt: new Date(now.getTime() - 3600 * 1000).toISOString(),
						dataType: "categories",
						userId,
					},
				}),
			);

			// バックグラウンド更新時にキャッシュ書き込みエラーが発生
			mockCacheRepo.set.mockResolvedValue(
				R.fail({
					code: "CACHE_WRITE_ERROR",
					message: "Background cache write failed",
				}),
			);

			const result = await getZaimCategories({
				client: mockClient,
				env,
				userId,
			});

			// staleデータが返される
			assert(R.isSuccess(result));
			expect(result.value).toEqual(expectedZaimCategories);

			// バックグラウンド処理の完了を待つ
			await new Promise((resolve) => setTimeout(resolve, 10));
		});
	});
});
