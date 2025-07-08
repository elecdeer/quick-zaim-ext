import { R } from "@praha/byethrow";
import { categoryGetCategories, genreGetGenres } from "@repo/zaim-api";
import type { Client } from "@repo/zaim-api/client";
import type { Env } from "../../env";
import * as logger from "../../logger";
import { getKVCacheRepository } from "../cache/kvCache";
import { type CacheError, zaimCategoriesCacheSchema } from "../cache/types";
import { withCache } from "../cache/withCache";
import type { ZaimCategory, ZaimServiceError } from "./types";

/**
 * Zaim APIからカテゴリとサブカテゴリを取得する（キャッシュ対応）
 */
export const getZaimCategories = ({
	client,
	env,
	userId,
	waitUntil,
}: {
	client: Client;
	env: Env;
	userId: string;
	waitUntil: (promise: Promise<unknown>) => void;
}): R.ResultAsync<ZaimCategory[], ZaimServiceError | CacheError> => {
	using _ = logger.metadata({
		service: "zaim-categories",
	});
	const cacheRepo = getKVCacheRepository(
		env,
		userId,
		"categories",
		zaimCategoriesCacheSchema,
	);

	return R.pipe(
		withCache({
			cacheRepo,
			fetcher: async () => {
				return await fetchFromAPI(client);
			},
		}),
		R.map(([zaimCategories, backgroundPromise]) => {
			if (backgroundPromise) {
				waitUntil(backgroundPromise);
			}
			return zaimCategories;
		}),
	);
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
