/**
 * Zaim カテゴリ取得ルート（ジャンルをサブカテゴリとしてネスト、KV キャッシュ付き）
 *
 * エンドポイント:
 *   GET /api/zaim/categories - カテゴリとサブカテゴリ（ジャンル）の一覧を返す
 */

import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import type { HonoEnv } from "../../env.ts";
import { requireOidcAuth, requireZaimClient } from "../../middleware.ts";
import { CategoriesQuerySchema } from "./schema.ts";
import { getCategories } from "./service.ts";

export const categoriesRoutes = new Hono<HonoEnv>().get(
  "/api/zaim/categories",
  requireOidcAuth,
  requireZaimClient,
  sValidator("query", CategoriesQuerySchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: "Invalid query parameters" }, 400);
    }
  }),
  async (c) => {
    const result = await getCategories({
      kv: c.env.ZAIM_KV,
      zaimClient: c.var.zaimClient,
      zaimUserId: c.var.zaimUserId,
      noCache: c.req.valid("query").no_cache === "1",
      logger: c.var.logger,
    });
    return c.json(result);
  },
);
