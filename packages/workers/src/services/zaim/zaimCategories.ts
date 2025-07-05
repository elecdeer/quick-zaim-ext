import { R } from "@praha/byethrow";
import { categoryGetCategories, genreGetGenres } from "@repo/zaim-api";
import type { Client } from "@repo/zaim-api/client";
import type { Env } from "../../env";
import * as logger from "../../logger";
import { getKVCacheRepository } from "../cache/kvCache";
import { zaimCategoriesCacheSchema } from "../cache/types";
import type { ZaimCategory, ZaimServiceError } from "./types";

/**
 * Zaim APIからカテゴリとサブカテゴリを取得する（キャッシュ対応）
 */
export const getZaimCategories = async ({
	client,
	env,
	userId,
}: {
	client: Client;
	env: Env;
	userId: string;
}): Promise<R.Result<ZaimCategory[], ZaimServiceError>> => {
	const cacheRepo = getKVCacheRepository(
		env,
		userId,
		"categories",
		zaimCategoriesCacheSchema,
	);

	// キャッシュからデータを取得
	const cacheResult = await cacheRepo.get();

	if (R.isSuccess(cacheResult) && cacheResult.value) {
		const { data: cachedData, isStale } = cacheResult.value;

		// キャッシュが新しい場合はそのまま返す
		if (!isStale) {
			logger.info({
				type: "zaim-categories-cache-hit",
				userId,
				isStale: false,
			});
			return R.succeed(cachedData.data);
		}

		// staleな場合はバックグラウンドで更新
		logger.info({
			type: "zaim-categories-cache-stale",
			userId,
			isStale: true,
		});

		// バックグラウンドでAPI呼び出し（非同期）
		fetchAndUpdateCache(client, env, userId).catch((error) => {
			logger.error({
				type: "zaim-categories-background-update-error",
				userId,
				error: error instanceof Error ? error.message : String(error),
			});
		});

		// staleなデータを返す
		return R.succeed(cachedData.data);
	}

	// キャッシュがない場合はAPIを呼び出し
	logger.info({
		type: "zaim-categories-cache-miss",
		userId,
	});

	const apiResult = await fetchFromAPI(client);
	if (R.isFailure(apiResult)) {
		return apiResult;
	}

	// 新しいデータをキャッシュに保存
	const cacheData = {
		data: apiResult.value,
		version: 1,
	};

	const setCacheResult = await cacheRepo.set(cacheData);

	if (R.isFailure(setCacheResult)) {
		logger.warn({
			type: "zaim-categories-cache-write-failed",
			userId,
			error: setCacheResult.error,
		});
		// キャッシュ保存失敗してもデータは返す
	}

	return R.succeed(apiResult.value);
};

/**
 * API からデータを取得する
 */
async function fetchFromAPI(
	client: Client,
): Promise<R.Result<ZaimCategory[], ZaimServiceError>> {
	const [categoriesRes, genreRes] = await Promise.all([
		categoryGetCategories({
			client,
			query: { mapping: 1 },
		}),
		genreGetGenres({
			client,
			query: { mapping: 1 },
		}),
	]);

	if (categoriesRes.error || genreRes.error) {
		return R.fail({
			code: "ZAIM_API_ERROR" as const,
			statusCode: 500 as const,
			message: "Failed to retrieve categories from Zaim API.",
			cause: categoriesRes.error || genreRes.error,
		});
	}

	return R.succeed(
		categoriesRes.data.categories.map((category) => ({
			id: category.id,
			name: category.name,
			subCategories: genreRes.data.genres
				.filter((genre) => genre.category_id === category.id)
				.map((genre) => ({
					id: genre.id,
					name: genre.name,
				})),
		})),
	);
}

/**
 * バックグラウンドでAPI呼び出しとキャッシュ更新を行う
 */
async function fetchAndUpdateCache(
	client: Client,
	env: Env,
	userId: string,
): Promise<void> {
	const apiResult = await fetchFromAPI(client);
	if (R.isFailure(apiResult)) {
		logger.error({
			type: "zaim-categories-background-fetch-error",
			userId,
			error: apiResult.error,
		});
		return;
	}

	const cacheData = {
		data: apiResult.value,
		version: 1,
	};

	const cacheRepo = getKVCacheRepository(
		env,
		userId,
		"categories",
		zaimCategoriesCacheSchema,
	);

	const setCacheResult = await cacheRepo.set(cacheData);

	if (R.isFailure(setCacheResult)) {
		logger.error({
			type: "zaim-categories-background-cache-error",
			userId,
			error: setCacheResult.error,
		});
	} else {
		logger.info({
			type: "zaim-categories-background-update-success",
			userId,
		});
	}
}
