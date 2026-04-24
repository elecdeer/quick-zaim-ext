/**
 * Zaim カテゴリ取得ルート（ジャンルをサブカテゴリとしてネスト、KV キャッシュ付き）
 *
 * エンドポイント:
 *   GET /api/zaim/categories - カテゴリとサブカテゴリ（ジャンル）の一覧を返す
 *
 * KV キー設計:
 *   zaim:cache:categories:{zaim_user_id} - カテゴリ＋サブカテゴリキャッシュ（TTL 1日）
 */

import { getAuth } from "@hono/oidc-auth";
import { Hono } from "hono";
import * as v from "valibot";
import type { Env } from "../env.ts";
import { buildZaimApiAuthHeader } from "../zaim-oauth.ts";
import { getStoredZaimToken } from "./zaim.ts";

const ZAIM_API_BASE = "https://api.zaim.net/v2";
const CACHE_TTL = 86400;

const CategorySchema = v.object({
  id: v.number(),
  name: v.string(),
  mode: v.union([v.literal("payment"), v.literal("income")]),
  sort: v.number(),
  parent_category_id: v.number(),
  active: v.number(),
  modified: v.string(),
  local_id: v.number(),
});

const GenreSchema = v.object({
  id: v.number(),
  name: v.string(),
  sort: v.number(),
  active: v.number(),
  category_id: v.number(),
  parent_genre_id: v.number(),
  modified: v.string(),
  local_id: v.number(),
});

const CategoriesResponseSchema = v.object({
  categories: v.array(CategorySchema),
});

const GenresResponseSchema = v.object({
  genres: v.array(GenreSchema),
});

const CategoryWithSubCategoriesSchema = v.object({
  id: v.number(),
  name: v.string(),
  mode: v.union([v.literal("payment"), v.literal("income")]),
  subCategories: v.array(
    v.object({
      id: v.number(),
      name: v.string(),
    }),
  ),
});

const CategoriesWithSubCategoriesResponseSchema = v.object({
  /** Zaim API からデータを取得した日時（ISO 8601） */
  fetchedAt: v.string(),
  categories: v.array(CategoryWithSubCategoriesSchema),
});

export type CategoryWithSubCategories = v.InferOutput<typeof CategoryWithSubCategoriesSchema>;
export type CategoriesWithSubCategoriesResponse = v.InferOutput<
  typeof CategoriesWithSubCategoriesResponseSchema
>;

type OAuthConfig = Parameters<typeof buildZaimApiAuthHeader>[0];

async function fetchZaimJson<T>(
  url: string,
  oauthConfig: OAuthConfig,
  schema: v.GenericSchema<unknown, T>,
): Promise<T> {
  const authHeader = await buildZaimApiAuthHeader(oauthConfig, "GET", url, { mapping: "1" });
  const response = await fetch(`${url}?mapping=1`, {
    headers: { Authorization: authHeader },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Zaim API error [${response.status}]: ${body}`);
  }
  return v.parse(schema, await response.json());
}

/**
 * カテゴリ＋サブカテゴリ（ジャンル）一覧取得
 *
 * カテゴリとジャンルを並行取得してネスト構造に変換し、KV に 1 日間キャッシュする。
 */
const getCategoriesRoute = new Hono<{ Bindings: Env }>().get("/api/zaim/categories", async (c) => {
  const auth = await getAuth(c);
  if (!auth?.sub) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = await getStoredZaimToken(c.env.ZAIM_KV, auth.sub);
  if (!token) {
    return c.json({ error: "Zaim not connected" }, 403);
  }

  const cacheKey = `zaim:cache:categories:${token.zaimUserId}`;
  const cached = await c.env.ZAIM_KV.get(cacheKey);
  if (cached) {
    return c.json(JSON.parse(cached) as CategoriesWithSubCategoriesResponse);
  }

  const oauthConfig: OAuthConfig = {
    consumerKey: c.env.ZAIM_CONSUMER_KEY,
    consumerSecret: c.env.ZAIM_CONSUMER_SECRET,
    token: token.oauthToken,
    tokenSecret: token.oauthTokenSecret,
  };

  const [categoriesData, genresData] = await Promise.all([
    fetchZaimJson(`${ZAIM_API_BASE}/home/category`, oauthConfig, CategoriesResponseSchema),
    fetchZaimJson(`${ZAIM_API_BASE}/home/genre`, oauthConfig, GenresResponseSchema),
  ]);

  const result: CategoriesWithSubCategoriesResponse = {
    fetchedAt: new Date().toISOString(),
    categories: categoriesData.categories.map((category) => ({
      id: category.id,
      name: category.name,
      mode: category.mode,
      subCategories: genresData.genres
        .filter((genre) => genre.category_id === category.id)
        .map((genre) => ({
          id: genre.id,
          name: genre.name,
        })),
    })),
  };

  await c.env.ZAIM_KV.put(cacheKey, JSON.stringify(result), { expirationTtl: CACHE_TTL });

  return c.json(result);
});

export const categoriesRoutes = new Hono<{ Bindings: Env }>().route("/", getCategoriesRoute);
