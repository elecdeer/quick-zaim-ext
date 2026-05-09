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
import { createClient } from "@repo/zaim-api/client";
import { sValidator } from "@hono/standard-validator";
import { getAuth } from "@hono/oidc-auth";
import { Hono } from "hono";
import * as v from "valibot";
import type { Env } from "../env.ts";
import { getStoredZaimToken } from "./zaim.ts";
import { createZaimAuthInterceptor } from "@repo/zaim-api/oauth/interceptor";
import type { OAuth1Config } from "@repo/zaim-api/oauth/oauth1";
import { accountsLogger } from "../logger.ts";

const AccountsQuerySchema = v.object({
  no_cache: v.optional(v.string()),
});

const ZAIM_API_BASE = "https://api.zaim.net";
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

async function fetchAccountsFromZaim(oauthConfig: OAuth1Config): Promise<AccountsResponse> {
  const client = createClient({ baseUrl: ZAIM_API_BASE });
  client.interceptors.request.use(createZaimAuthInterceptor(oauthConfig));

  accountsLogger.debug("Fetching accounts from Zaim API");

  const result = await accountGetAccounts({
    client,
    query: { mapping: 1 },
  });

  if (!result.data) {
    accountsLogger.error("Failed to fetch accounts from Zaim API");
    throw new Error("Failed to fetch accounts from Zaim API");
  }

  const accountCount = result.data.accounts.length;
  accountsLogger.with({ accountCount }).debug("Zaim API returned {accountCount} accounts");

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
const getAccountsRoute = new Hono<{ Bindings: Env }>().get(
  "/api/zaim/accounts",
  sValidator("query", AccountsQuerySchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: "Invalid query parameters" }, 400);
    }
  }),
  async (c) => {
    const auth = await getAuth(c);
    if (!auth?.sub) {
      accountsLogger.warn("Accounts: unauthorized (no OIDC session)");
      return c.json({ error: "Unauthorized" }, 401);
    }

    const token = await getStoredZaimToken(c.env.ZAIM_KV, auth.sub);
    if (!token) {
      accountsLogger.with({ userSub: auth.sub }).warn("Accounts: Zaim not connected for {userSub}");
      return c.json({ error: "Zaim not connected" }, 403);
    }

    const { no_cache: noCache } = c.req.valid("query");
    const cacheKey = `zaim:cache:accounts:${token.zaimUserId}`;

    if (noCache !== "1") {
      const cached = await c.env.ZAIM_KV.get(cacheKey);
      if (cached) {
        accountsLogger
          .with({ zaimUserId: token.zaimUserId })
          .debug("Accounts cache hit for Zaim user {zaimUserId}");
        return c.json(JSON.parse(cached) as AccountsResponse);
      }
      accountsLogger
        .with({ zaimUserId: token.zaimUserId })
        .debug("Accounts cache miss for Zaim user {zaimUserId}, fetching from API");
    } else {
      accountsLogger
        .with({ zaimUserId: token.zaimUserId })
        .debug("Accounts cache bypassed (no_cache=1) for Zaim user {zaimUserId}");
    }

    const oauthConfig: OAuth1Config = {
      consumerKey: c.env.ZAIM_CONSUMER_KEY,
      consumerSecret: c.env.ZAIM_CONSUMER_SECRET,
      token: token.oauthToken,
      tokenSecret: token.oauthTokenSecret,
    };

    const result = await fetchAccountsFromZaim(oauthConfig);

    await c.env.ZAIM_KV.put(cacheKey, JSON.stringify(result), { expirationTtl: CACHE_TTL });
    accountsLogger
      .with({ zaimUserId: token.zaimUserId, ttl: CACHE_TTL })
      .debug("Accounts cached for Zaim user {zaimUserId} (TTL={ttl}s)");

    return c.json(result);
  },
);

export const accountsRoutes = new Hono<{ Bindings: Env }>().route("/", getAccountsRoute);
