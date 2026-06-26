/**
 * Zaim 支払い方法（口座）取得ルート（KV キャッシュ付き）
 *
 * エンドポイント:
 *   GET /api/zaim/accounts - 支払い方法（口座）の一覧を返す
 */

import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import type { HonoEnv } from "../../env.ts";
import { requireOidcAuth, requireZaimClient } from "../../middleware.ts";
import { AccountsQuerySchema } from "./schema.ts";
import { getAccounts } from "./service.ts";

export const accountsRoutes = new Hono<HonoEnv>().get(
  "/api/zaim/accounts",
  requireOidcAuth,
  requireZaimClient,
  sValidator("query", AccountsQuerySchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: "Invalid query parameters" }, 400);
    }
  }),
  async (c) => {
    const result = await getAccounts({
      kv: c.env.ZAIM_KV,
      zaimClient: c.var.zaimClient,
      zaimUserId: c.var.zaimUserId,
      noCache: c.req.valid("query").no_cache === "1",
      logger: c.var.logger,
    });
    return c.json(result);
  },
);
