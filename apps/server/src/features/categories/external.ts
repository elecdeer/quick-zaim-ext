import { categoryGetCategories, genreGetGenres } from "@repo/zaim-api";
import type { createClient } from "@repo/zaim-api/client";
import type { Logger } from "../../loggerMiddleware.ts";
import type { CategoriesResponse } from "./schema.ts";

/**
 * Zaim API からカテゴリとジャンルを並行取得してネスト構造に変換する。
 */
export const fetchCategoriesFromZaim = async (
  client: ReturnType<typeof createClient>,
  logger: Logger,
): Promise<CategoriesResponse> => {
  logger.debug("Fetching categories and genres from Zaim API in parallel");

  const [categoriesResult, genresResult] = await Promise.all([
    categoryGetCategories({
      client,
      query: { mapping: 1 },
    }),
    genreGetGenres({
      client,
      query: { mapping: 1 },
    }),
  ]);

  if (!categoriesResult.data || !genresResult.data) {
    logger.error("Failed to fetch categories or genres from Zaim API");
    throw new Error("Failed to fetch categories from Zaim API");
  }

  const categoryCount = categoriesResult.data.categories.length;
  const genreCount = genresResult.data.genres.length;
  logger
    .with({ categoryCount, genreCount })
    .debug("Zaim API returned {categoryCount} categories and {genreCount} genres");

  return {
    fetchedAt: new Date().toISOString(),
    categories: categoriesResult.data.categories.map((category) => ({
      id: category.id,
      name: category.name,
      mode: category.mode,
      subCategories: (genresResult.data?.genres ?? [])
        .filter((genre) => genre.category_id === category.id)
        .map((genre) => ({ id: genre.id, name: genre.name })),
    })),
  };
};
