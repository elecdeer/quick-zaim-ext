/**
 * Zaim 支払い方法（口座）取得ルート（KV キャッシュ付き）
 *
 * エンドポイント:
 *   GET /api/zaim/accounts - 支払い方法（口座）の一覧を返す
 *
 * KV キー設計:
 *   zaim:cache:accounts:{zaim_user_id} - 口座キャッシュ（TTL 1日）
 */

import { accountGetAccounts } from "@repo/zaim-api";
import type { createClient } from "@repo/zaim-api/client";
import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import * as v from "valibot";
import type { HonoEnv } from "../env.ts";
import type { Logger } from "../loggerMiddleware.ts";
import { requireOidcAuth, requireZaimClient } from "../middleware.ts";

const AccountsQuerySchema = v.object({
  no_cache: v.optional(v.string()),
});

const CACHE_TTL = 86400;

export type Account = {
  id: number;
  name: string;
  modified: string;
  sort: number;
  active: number;
  localId: number;
  websiteId: number;
  parentAccountId: number;
};

export type AccountsResponse = {
  /** Zaim API からデータを取得した日時（ISO 8601） */
  fetchedAt: string;
  accounts: Account[];
};

async function fetchAccountsFromZaim(
  client: ReturnType<typeof createClient>,
  logger: Logger,
): Promise<AccountsResponse> {
  logger.debug("Fetching accounts from Zaim API");

  const result = await accountGetAccounts({
    client,
    query: { mapping: 1 },
  });

  if (!result.data) {
    logger.error("Failed to fetch accounts from Zaim API");
    throw new Error("Failed to fetch accounts from Zaim API");
  }

  const accountCount = result.data.accounts.length;
  logger.with({ accountCount }).debug("Zaim API returned {accountCount} accounts");

  return {
    fetchedAt: new Date().toISOString(),
    accounts: result.data.accounts.map((account) => ({
      id: account.id,
      name: account.name,
      modified: account.modified,
      sort: account.sort,
      active: account.active,
      localId: account.local_id,
      websiteId: account.website_id,
      parentAccountId: account.parent_account_id,
    })),
  };
}

/**
 * 支払い方法（口座）一覧取得
 *
 * Zaim API から口座一覧を取得し、KV に 1 日間キャッシュする。
 */
const getAccountsRoute = new Hono<HonoEnv>().get(
  "/api/zaim/accounts",
  requireOidcAuth,
  requireZaimClient,
  sValidator("query", AccountsQuerySchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: "Invalid query parameters" }, 400);
    }
  }),
  async (c) => {
    const logger = c.var.logger;
    const { zaimClient, zaimUserId } = c.var;

    const { no_cache: noCache } = c.req.valid("query");
    const cacheKey = `zaim:cache:accounts:${zaimUserId}`;

    if (noCache !== "1") {
      const cached = await c.env.ZAIM_KV.get(cacheKey);
      if (cached) {
        logger.with({ zaimUserId }).debug("Accounts cache hit for Zaim user {zaimUserId}");
        return c.json(JSON.parse(cached) as AccountsResponse);
      }
      logger
        .with({ zaimUserId })
        .debug("Accounts cache miss for Zaim user {zaimUserId}, fetching from API");
    } else {
      logger
        .with({ zaimUserId })
        .debug("Accounts cache bypassed (no_cache=1) for Zaim user {zaimUserId}");
    }

    const result = await fetchAccountsFromZaim(zaimClient, logger);

    await c.env.ZAIM_KV.put(cacheKey, JSON.stringify(result), { expirationTtl: CACHE_TTL });
    logger
      .with({ zaimUserId, ttl: CACHE_TTL })
      .debug("Accounts cached for Zaim user {zaimUserId} (TTL={ttl}s)");

    return c.json(result);
  },
);

export const accountsRoutes = new Hono<HonoEnv>().route("/", getAccountsRoute);
