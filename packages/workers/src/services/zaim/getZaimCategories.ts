import {
	type CategoryCategory,
	type GenreGenre,
	categoryGetCategories,
	genreGetGenres,
} from "@repo/zaim-api";
import type { Env } from "../../env"; // Adjusted path
import * as logger from "../../logger"; // Adjusted path (though not used directly here, keep for consistency or remove if unused)
import type { ZaimCategory } from "./types"; // Import the specific type
import { configureZaimClient } from "./zaimAuth"; // Import client config function

/**
 * Zaimからカテゴリとジャンルを取得・整形する
 */
export const getZaimCategories = async ({
	env,
	oidcSub, // Keep oidcSub if needed for logging or other purposes, otherwise remove
	accessToken,
	accessTokenSecret,
}: {
	env: Env;
	oidcSub: string; // Or remove if not needed
	accessToken: string;
	accessTokenSecret: string;
}): Promise<ZaimCategory[]> => {
	// Configure the client using the provided tokens
	const client = configureZaimClient({
		accessToken,
		accessTokenSecret,
		consumerKey: env.ZAIM_CONSUMER_KEY,
		consumerSecret: env.ZAIM_CONSUMER_SECRET,
	});

	try {
		// カテゴリとジャンル（サブカテゴリ）を取得 (pass client instance)
		const categoriesResponse = await categoryGetCategories({
			client: client, // Pass the configured client
			query: { mapping: 1 },
			throwOnError: true,
		});
		const genresResponse = await genreGetGenres({
			client: client, // Pass the configured client
			query: { mapping: 1 },
			throwOnError: true,
		});

		if (!categoriesResponse.data?.categories || !genresResponse.data?.genres) {
			throw new Error("Failed to retrieve categories or genres from Zaim API");
		}

		// カテゴリとサブカテゴリを整形
		const categories = categoriesResponse.data.categories.map(
			(category: CategoryCategory) => {
				// このカテゴリに属するジャンル（サブカテゴリ）を取得
				const subCategories = genresResponse.data.genres
					.filter((genre: GenreGenre) => genre.category_id === category.id)
					.map((genre: GenreGenre) => ({
						id: String(genre.id),
						name: genre.name,
					}));

				return {
					id: String(category.id),
					name: category.name,
					subCategories,
				};
			},
		);

		return categories;
	} catch (error: unknown) {
		// Add type
		logger.error({
			// Use logger for errors
			message: "Zaim API error in getZaimCategories",
			oidcSub: oidcSub, // Log relevant info
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
		});
		// API呼び出しエラーを再スローするか、カスタムエラーを投げる
		// Consider throwing a more specific error or returning an empty array/null
		throw new Error("Failed to call Zaim API for categories/genres");
	}
};
