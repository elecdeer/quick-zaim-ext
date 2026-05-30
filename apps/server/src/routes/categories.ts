/**
 * Zaim カテゴリ取得ルート（ジャンルをサブカテゴリとしてネスト、KV キャッシュ付き）
 *
 * エンドポイント:
 *   GET /api/zaim/categories - カテゴリとサブカテゴリ（ジャンル）の一覧を返す
 *
 * KV キー設計:
 *   zaim:cache:categories:{zaim_user_id} - カテゴリ＋サブカテゴリキャッシュ（TTL 1日）
 */

import { categoryGetCategories, genreGetGenres } from "@repo/zaim-api";
import type { createClient } from "@repo/zaim-api/client";
import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import * as v from "valibot";
import type { HonoEnv } from "../env.ts";
import type { Logger } from "../loggerMiddleware.ts";
import { requireOidcAuth, requireZaimClient } from "../middleware.ts";

const CategoriesQuerySchema = v.object({
  no_cache: v.optional(v.string()),
});

const CACHE_TTL = 86400;

type SubCategory = { id: number; name: string };

type CategoryWithSubCategories = {
  id: number;
  name: string;
  mode: "payment" | "income";
  subCategories: SubCategory[];
};

export type CategoriesResponse = {
  /** Zaim API からデータを取得した日時（ISO 8601） */
  fetchedAt: string;
  categories: CategoryWithSubCategories[];
};

const fetchCategoriesFromZaim = async (
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

/**
 * カテゴリ＋サブカテゴリ（ジャンル）一覧取得
 *
 * カテゴリとジャンルを並行取得してネスト構造に変換し、KV に 1 日間キャッシュする。
 */
const getCategoriesRoute = new Hono<HonoEnv>().get(
  "/api/zaim/categories",
  requireOidcAuth,
  requireZaimClient,
  sValidator("query", CategoriesQuerySchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: "Invalid query parameters" }, 400);
    }
  }),
  async (c) => {
    const logger = c.var.logger;
    const { zaimClient, zaimUserId } = c.var;

    const { no_cache: noCache } = c.req.valid("query");
    const cacheKey = `zaim:cache:categories:${zaimUserId}`;

    if (noCache !== "1") {
      const cached = await c.env.ZAIM_KV.get(cacheKey);
      if (cached) {
        logger.with({ zaimUserId }).debug("Categories cache hit for Zaim user {zaimUserId}");
        return c.json(JSON.parse(cached) as CategoriesResponse);
      }
      logger
        .with({ zaimUserId })
        .debug("Categories cache miss for Zaim user {zaimUserId}, fetching from API");
    } else {
      logger
        .with({ zaimUserId })
        .debug("Categories cache bypassed (no_cache=1) for Zaim user {zaimUserId}");
    }

    const result = await fetchCategoriesFromZaim(zaimClient, logger);

    await c.env.ZAIM_KV.put(cacheKey, JSON.stringify(result), { expirationTtl: CACHE_TTL });
    logger
      .with({ zaimUserId, ttl: CACHE_TTL })
      .debug("Categories cached for Zaim user {zaimUserId} (TTL={ttl}s)");

    return c.json(result);
  },
);

export const categoriesRoutes = new Hono<HonoEnv>().route("/", getCategoriesRoute);
