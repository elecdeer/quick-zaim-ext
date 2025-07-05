import { env } from "cloudflare:test";
import { R } from "@praha/byethrow";
import * as v from "valibot";
import { assert, test as baseTest, describe, expect } from "vitest";
import { getKVCacheRepository, type KVCacheRepository } from "./kvCache";

// テスト用のスキーマ
const testCacheSchema = v.object({
	data: v.array(
		v.object({
			id: v.number(),
			name: v.string(),
		}),
	),
	version: v.number(),
});

type TestCacheData = v.InferOutput<typeof testCacheSchema>;

const userId = "test-user-id";
const dataType = "categories" as const;

const test = baseTest.extend<{
	repository: KVCacheRepository<TestCacheData>;
}>({
	repository: async ({}, use) => {
		// Cloudflare Workers環境のenvを取得
		const repository = getKVCacheRepository(
			env,
			userId,
			dataType,
			testCacheSchema,
		);

		// テスト前にキャッシュをクリア
		await repository.delete();

		// fixtureを使用
		await use(repository);
	},
});

describe("getKVCacheRepository", () => {
	describe("get", () => {
		const testData: TestCacheData = {
			data: [
				{ id: 1, name: "Test Category 1" },
				{ id: 2, name: "Test Category 2" },
			],
			version: 1,
		};

		test("キャッシュが存在しない場合にnullを返す", async ({ repository }) => {
			const result = await repository.get();

			assert(R.isSuccess(result));
			expect(result.value).toBeNull();
		});

		test("データ保存後に取得できる", async ({ repository }) => {
			// まずデータを保存
			const setResult = await repository.set(testData);
			assert(R.isSuccess(setResult));

			// 保存したデータを取得
			const result = await repository.get();

			assert(R.isSuccess(result));
			assert(result.value !== null);
			expect(result.value.data).toEqual(testData);
			expect(result.value.isStale).toBe(false);
			expect(result.value.metadata.dataType).toBe("categories");
			expect(result.value.metadata.userId).toBe(userId);
		});
	});

	describe("set", () => {
		const testData: TestCacheData = {
			data: [
				{ id: 1, name: "Test Category 1" },
				{ id: 2, name: "Test Category 2" },
			],
			version: 1,
		};

		test("データを正常に保存できる", async ({ repository }) => {
			const result = await repository.set(testData);

			assert(R.isSuccess(result));
		});

		test("不正なデータスキーマの場合にエラーを返す", async ({ repository }) => {
			const invalidData = { invalid: "data" } as unknown as TestCacheData;

			const result = await repository.set(invalidData);

			assert(R.isFailure(result));
			expect(result.error.code).toBe("CACHE_WRITE_ERROR");
		});
	});

	describe("delete", () => {
		test("キャッシュを正常に削除できる", async ({ repository }) => {
			const testData: TestCacheData = {
				data: [{ id: 1, name: "Test Category" }],
				version: 1,
			};

			// データを保存
			await repository.set(testData);

			// データが存在することを確認
			const getResult = await repository.get();
			assert(R.isSuccess(getResult));
			expect(getResult.value).not.toBeNull();

			// データを削除
			await repository.delete();

			// データが削除されたことを確認
			const getAfterDeleteResult = await repository.get();
			assert(R.isSuccess(getAfterDeleteResult));
			expect(getAfterDeleteResult.value).toBeNull();
		});
	});
});
