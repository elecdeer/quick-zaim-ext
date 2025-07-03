import { R } from "@praha/byethrow";
import { categoryGetCategories, genreGetGenres } from "@repo/zaim-api";
import type { Client } from "@repo/zaim-api/client";
import type { ZaimCategory, ZaimServiceError } from "./types";

/**
 * Zaim APIからカテゴリとサブカテゴリを取得する
 */
export const getZaimCategories = async ({
	client,
}: {
	client: Client;
}): Promise<R.Result<ZaimCategory[], ZaimServiceError>> => {
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
};
