import { R } from "@praha/byethrow";
import { categoryGetCategories, genreGetGenres } from "@repo/zaim-api";
import type { Client } from "@repo/zaim-api/client";
import type { Env } from "../../env";
import * as logger from "../../logger";
import { getKVCacheRepository } from "../cache/kvCache";
import {
	type CacheError,
	zaimCategoriesCacheSchema,
	zaimGenresCacheSchema,
} from "../cache/types";
import { withCache } from "../cache/withCache";
import type { ZaimCategory, ZaimGenre, ZaimServiceError } from "./types";

/**
 * Zaim APIからカテゴリとサブカテゴリを取得する（キャッシュ対応）
 */
export const getZaimCategories = ({
	client,
	env,
	userId,
}: {
	client: Client;
	env: Env;
	userId: string;
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

	return withCache({
		cacheRepo,
		fetcher: async () => {
			return await fetchFromAPI(client);
		},
	});
};

/**
 * Zaim APIからジャンル一覧を取得する（キャッシュ対応）
 */
export const getZaimGenres = ({
	client,
	env,
	userId,
}: {
	client: Client;
	env: Env;
	userId: string;
}): R.ResultAsync<ZaimGenre[], ZaimServiceError | CacheError> => {
	const cacheRepo = getKVCacheRepository(
		env,
		userId,
		"genres",
		zaimGenresCacheSchema,
	);

	return withCache({
		cacheRepo,
		fetcher: () => fetchGenresFromAPI(client),
	});
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
 * ジャンルAPIからデータを取得する
 */
async function fetchGenresFromAPI(
	client: Client,
): Promise<R.Result<ZaimGenre[], ZaimServiceError>> {
	const genreRes = await genreGetGenres({
		client,
		query: { mapping: 1 },
	});

	if (genreRes.error) {
		return R.fail({
			code: "ZAIM_API_ERROR" as const,
			statusCode: 500 as const,
			message: "Failed to retrieve genres from Zaim API.",
			cause: genreRes.error,
		});
	}

	return R.succeed(
		genreRes.data.genres.map((genre) => ({
			id: genre.id,
			name: genre.name,
			categoryId: genre.category_id,
		})),
	);
}
