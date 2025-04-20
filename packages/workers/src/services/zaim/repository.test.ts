import { assert, beforeEach, describe, expect, test, vi } from "vitest";
import type { Env } from "../../env";
import { isErr, ok } from "../../result";
import { getZaimRepository } from "./repository";

// KVNamespaceのモック
const mockKV = {
	put: vi.fn(),
	get: vi.fn(),
	delete: vi.fn(),
};

// Envのモック
const mockEnv = {
	ZAIM_AGENT_ZAIM_TOKENS_KV: mockKV,
	// 他に必要なEnvプロパティがあればここに追加
} as unknown as Env;

const userId = "test-user-id";

describe("getZaimRepository", () => {
	let repository: ReturnType<typeof getZaimRepository>;

	beforeEach(() => {
		// 各テストの前にモックをリセット
		vi.resetAllMocks();
		repository = getZaimRepository(mockEnv, userId);
	});

	describe("saveTemporalRequestToken", () => {
		const oauthToken = "test-token";
		const oauthTokenSecret = "test-secret";
		const expirationSeconds = 3600;
		const kvValue = JSON.stringify({ oauthTokenSecret });

		test("トークンを正常に保存できる", async () => {
			mockKV.put.mockResolvedValue(undefined); // putが成功するケース

			const result = await repository.saveTemporalRequestToken(
				{ oauthToken, oauthTokenSecret },
				{ expirationSeconds },
			);

			expect(result).toBeUndefined();
			expect(mockKV.put).toHaveBeenCalledTimes(1);
			expect(mockKV.put).toHaveBeenCalledWith(
				expect.stringContaining(userId),
				kvValue,
				{ expirationTtl: expirationSeconds },
			);
		});
	});

	describe("readTemporalRequestToken", () => {
		const oauthToken = "test-token-read";
		const oauthTokenSecret = "test-secret-read";

		test("トークンを正常に読み取れる", async () => {
			mockKV.get.mockResolvedValue(JSON.stringify({ oauthTokenSecret })); // getが成功するケース

			const result = await repository.readTemporalRequestToken(oauthToken);

			expect(result).toEqual(ok({ oauthToken, oauthTokenSecret }));
			expect(mockKV.get).toHaveBeenCalledTimes(1);
			expect(mockKV.get).toHaveBeenCalledWith(expect.stringContaining(userId));
			expect(mockKV.get).toHaveBeenCalledWith(
				expect.stringContaining(oauthToken),
			);
		});

		test("トークンがKVに存在しない場合にNOT_FOUNDを返す", async () => {
			mockKV.get.mockResolvedValue(null); // getがnullを返すケース

			const result = await repository.readTemporalRequestToken(oauthToken);

			assert(isErr(result));
			expect(result.error.code).toBe("NOT_FOUND");
			expect(mockKV.get).toHaveBeenCalledTimes(1);
			expect(mockKV.get).toHaveBeenCalledWith(expect.stringContaining(userId));
		});
	});
	describe("expireTemporalRequestToken", () => {
		const oauthToken = "test-token-expire";

		test("トークンを正常に削除できる", async () => {
			mockKV.delete.mockResolvedValue(undefined); // deleteが成功するケース

			await repository.expireTemporalRequestToken(oauthToken);

			expect(mockKV.delete).toHaveBeenCalledTimes(1);
			expect(mockKV.delete).toHaveBeenCalledWith(
				expect.stringContaining(userId),
			);
			expect(mockKV.delete).toHaveBeenCalledWith(
				expect.stringContaining(oauthToken),
			);
		});
	});

	describe("saveAccessToken", () => {
		const accessToken = "test-access-token";
		const accessTokenSecret = "test-access-secret";

		test("アクセストークンを正常に保存できる", async () => {
			mockKV.put.mockResolvedValue(undefined); // putが成功するケース

			await repository.saveAccessToken({ accessToken, accessTokenSecret });

			expect(mockKV.put).toHaveBeenCalledTimes(1);
			expect(mockKV.put).toHaveBeenCalledWith(
				expect.stringContaining(userId),
				expect.stringContaining(accessToken),
				expect.objectContaining({ expirationTtl: 60 * 60 * 24 * 30 }),
			);
		});
	});

	describe("readAccessToken", () => {
		const accessToken = "test-access-token-read";
		const accessTokenSecret = "test-access-secret-read";

		test("アクセストークンを正常に読み取れる", async () => {
			const fixedTimestamp = "2023-01-01T00:00:00.000Z";
			mockKV.get.mockResolvedValue(
				JSON.stringify({
					accessToken,
					accessTokenSecret,
					updatedAt: fixedTimestamp,
				}),
			); // getが成功するケース

			const result = await repository.readAccessToken();

			expect(result).toEqual(ok({ accessToken, accessTokenSecret }));
			expect(mockKV.get).toHaveBeenCalledTimes(1);
			expect(mockKV.get).toHaveBeenCalledWith(expect.stringContaining(userId));
		});

		test("アクセストークンがKVに存在しない場合にNOT_FOUNDを返す", async () => {
			mockKV.get.mockResolvedValue(null); // getがnullを返すケース

			const result = await repository.readAccessToken();

			assert(isErr(result));
			expect(result.error.code).toBe("NOT_FOUND");
			expect(mockKV.get).toHaveBeenCalledTimes(1);
			expect(mockKV.get).toHaveBeenCalledWith(expect.stringContaining(userId));
		});
	});
});
