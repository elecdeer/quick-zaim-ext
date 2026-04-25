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
import { createClient } from "@repo/zaim-api/client";
import { getAuth } from "@hono/oidc-auth";
import { Hono } from "hono";
import type { Env } from "../env.ts";
import { buildZaimApiAuthHeader } from "../zaim-oauth.ts";
import type { OAuth1Config } from "../oauth1.ts";
import { getStoredZaimToken } from "./zaim.ts";

const ZAIM_API_BASE = "https://api.zaim.net";
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

async function fetchCategoriesFromZaim(oauthConfig: OAuth1Config): Promise<CategoriesResponse> {
  const [categoryAuthHeader, genreAuthHeader] = await Promise.all([
    buildZaimApiAuthHeader(oauthConfig, "GET", `${ZAIM_API_BASE}/v2/home/category`, { mapping: "1" }),
    buildZaimApiAuthHeader(oauthConfig, "GET", `${ZAIM_API_BASE}/v2/home/genre`, { mapping: "1" }),
  ]);

  const [categoriesResult, genresResult] = await Promise.all([
    categoryGetCategories({
      client: createClient({
        baseUrl: ZAIM_API_BASE,
        headers: { Authorization: categoryAuthHeader },
      }),
      query: { mapping: 1 },
    }),
    genreGetGenres({
      client: createClient({ baseUrl: ZAIM_API_BASE, headers: { Authorization: genreAuthHeader } }),
      query: { mapping: 1 },
    }),
  ]);

  if (!categoriesResult.data || !genresResult.data) {
    throw new Error("Failed to fetch categories from Zaim API");
  }

  return {
    fetchedAt: new Date().toISOString(),
    categories: categoriesResult.data.categories.map((category) => ({
      id: category.id,
      name: category.name,
      mode: category.mode,
      subCategories: genresResult
        .data!.genres.filter((genre) => genre.category_id === category.id)
        .map((genre) => ({ id: genre.id, name: genre.name })),
    })),
  };
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
    return c.json(JSON.parse(cached) as CategoriesResponse);
  }

  const oauthConfig: OAuth1Config = {
    consumerKey: c.env.ZAIM_CONSUMER_KEY,
    consumerSecret: c.env.ZAIM_CONSUMER_SECRET,
    token: token.oauthToken,
    tokenSecret: token.oauthTokenSecret,
  };

  const result = await fetchCategoriesFromZaim(oauthConfig);

  await c.env.ZAIM_KV.put(cacheKey, JSON.stringify(result), { expirationTtl: CACHE_TTL });

  return c.json(result);
});

export const categoriesRoutes = new Hono<{ Bindings: Env }>().route("/", getCategoriesRoute);
