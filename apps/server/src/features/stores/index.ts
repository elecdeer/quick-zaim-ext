/**
 * Zaim 店舗一覧取得ルート（KV キャッシュ付き）
 *
 * エンドポイント:
 *   GET /api/zaim/stores - 過去の支払いアイテムから集約した店舗一覧を返す
 */

import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import type { HonoEnv } from "../../env.ts";
import { requireOidcAuth, requireZaimClient } from "../../middleware.ts";
import { StoresQuerySchema } from "./schema.ts";
import { getStores } from "./service.ts";

export const storesRoutes = new Hono<HonoEnv>().get(
  "/api/zaim/stores",
  requireOidcAuth,
  requireZaimClient,
  sValidator("query", StoresQuerySchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: "Invalid query parameters" }, 400);
    }
  }),
  async (c) => {
    const result = await getStores({
      kv: c.env.ZAIM_KV,
      zaimClient: c.var.zaimClient,
      zaimUserId: c.var.zaimUserId,
      noCache: c.req.valid("query").no_cache === "1",
      logger: c.var.logger,
    });
    return c.json(result);
  },
);
