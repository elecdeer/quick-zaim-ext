/**
 * Zaim 店舗一覧取得ルート（KV キャッシュ付き）
 *
 * エンドポイント:
 *   GET /api/zaim/stores - 過去の支払いアイテムから集約した店舗一覧を返す
 *
 * KV キー設計:
 *   zaim:cache:stores:{zaim_user_id}           - 店舗リストキャッシュ（TTL 1時間）
 *   zaim:cache:money:{zaim_user_id}:{yyyy-mm}  - 月別支払いアイテムキャッシュ
 *     - 過去月: TTL 30日（事実上不変）
 *     - 当月: TTL 1時間（支払い追加で変化する）
 */

import { moneyGetMoney } from "@repo/zaim-api";
import { createClient } from "@repo/zaim-api/client";
import { sValidator } from "@hono/standard-validator";
import { getAuth } from "@hono/oidc-auth";
import { Hono } from "hono";
import * as v from "valibot";
import type { Env } from "../env.ts";
import { getStoredZaimToken } from "./zaim.ts";
import { createZaimAuthInterceptor } from "@repo/zaim-api/oauth/interceptor";
import type { OAuth1Config } from "@repo/zaim-api/oauth/oauth1";
import { storesLogger } from "../logger.ts";

const StoresQuerySchema = v.object({
  no_cache: v.optional(v.string()),
});

const ZAIM_API_BASE = "https://api.zaim.net";
const STORES_CACHE_TTL = 3600;
const CURRENT_MONTH_MONEY_TTL = 3600;
const PAST_MONTH_MONEY_TTL = 2592000;

export type Store = {
  place: string;
  placeUid: string;
  latestDate: string;
  count: number;
};

export type MoneyItem = {
  id: number;
  date: string;
  amount: number;
  place: string;
  placeUid: string;
  mode: "income" | "payment" | "transfer";
  categoryId: number;
  genreId: number;
};

export type MonthlyMoneyCache = {
  fetchedAt: string;
  items: MoneyItem[];
};

export type StoresResponse = {
  /** Zaim API からデータを取得した日時（ISO 8601） */
  fetchedAt: string;
  stores: Store[];
};

function currentYearMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function yearMonthOf(date: string): string {
  return date.slice(0, 7);
}

async function fetchAllMoneyFromZaim(oauthConfig: OAuth1Config): Promise<MoneyItem[]> {
  const client = createClient({ baseUrl: ZAIM_API_BASE });
  client.interceptors.request.use(createZaimAuthInterceptor(oauthConfig));

  storesLogger.debug("Fetching all money items from Zaim API");

  const result = await moneyGetMoney({
    client,
    query: { mapping: 1, mode: "payment" },
  });

  if (!result.data) {
    storesLogger.error("Failed to fetch money items from Zaim API");
    throw new Error("Failed to fetch money items from Zaim API");
  }

  // result.data.money may be typed as any[] depending on the generated client version,
  // so we explicitly assert the shape to avoid TS7006 implicit-any errors.
  type ZaimMoneyApiItem = {
    id: number;
    mode: "income" | "payment" | "transfer";
    date: string;
    category_id: number;
    genre_id: number;
    amount: number;
    place: string;
    place_uid: string;
  };
  const moneyList = result.data.money as ZaimMoneyApiItem[];

  const items = moneyList
    .filter((m) => m.place)
    .map((m) => ({
      id: m.id,
      date: m.date,
      amount: m.amount,
      place: m.place,
      placeUid: m.place_uid,
      mode: m.mode,
      categoryId: m.category_id,
      genreId: m.genre_id,
    }));

  storesLogger.with({ itemCount: items.length }).debug("Zaim API returned {itemCount} money items with places");

  return items;
}

function aggregateStores(items: MoneyItem[]): Store[] {
  const storeMap = new Map<string, Store>();

  for (const item of items) {
    const key = item.placeUid || item.place;
    const existing = storeMap.get(key);
    if (existing) {
      existing.count++;
      if (item.date > existing.latestDate) {
        existing.latestDate = item.date;
      }
    } else {
      storeMap.set(key, {
        place: item.place,
        placeUid: item.placeUid,
        latestDate: item.date,
        count: 1,
      });
    }
  }

  return Array.from(storeMap.values()).sort((a, b) => b.latestDate.localeCompare(a.latestDate));
}

async function buildAndCacheMonthlyData(
  kv: KVNamespace,
  zaimUserId: string,
  items: MoneyItem[],
): Promise<void> {
  const thisMonth = currentYearMonth();
  const byMonth = new Map<string, MoneyItem[]>();

  for (const item of items) {
    const ym = yearMonthOf(item.date);
    const group = byMonth.get(ym);
    if (group) {
      group.push(item);
    } else {
      byMonth.set(ym, [item]);
    }
  }

  const fetchedAt = new Date().toISOString();
  const puts: Promise<void>[] = [];

  for (const [ym, monthItems] of byMonth) {
    const cacheKey = `zaim:cache:money:${zaimUserId}:${ym}`;
    const ttl = ym < thisMonth ? PAST_MONTH_MONEY_TTL : CURRENT_MONTH_MONEY_TTL;
    const value: MonthlyMoneyCache = { fetchedAt, items: monthItems };
    puts.push(kv.put(cacheKey, JSON.stringify(value), { expirationTtl: ttl }));
  }

  await Promise.all(puts);

  storesLogger
    .with({ zaimUserId, monthCount: byMonth.size })
    .debug("Cached {monthCount} monthly money caches for Zaim user {zaimUserId}");
}

const getStoresRoute = new Hono<{ Bindings: Env }>().get(
  "/api/zaim/stores",
  sValidator("query", StoresQuerySchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: "Invalid query parameters" }, 400);
    }
  }),
  async (c) => {
    const auth = await getAuth(c);
    if (!auth?.sub) {
      storesLogger.warn("Stores: unauthorized (no OIDC session)");
      return c.json({ error: "Unauthorized" }, 401);
    }

    const token = await getStoredZaimToken(c.env.ZAIM_KV, auth.sub);
    if (!token) {
      storesLogger.with({ userSub: auth.sub }).warn("Stores: Zaim not connected for {userSub}");
      return c.json({ error: "Zaim not connected" }, 403);
    }

    const { no_cache: noCache } = c.req.valid("query");
    const storesCacheKey = `zaim:cache:stores:${token.zaimUserId}`;

    if (noCache !== "1") {
      const cached = await c.env.ZAIM_KV.get(storesCacheKey);
      if (cached) {
        storesLogger
          .with({ zaimUserId: token.zaimUserId })
          .debug("Stores cache hit for Zaim user {zaimUserId}");
        return c.json(JSON.parse(cached) as StoresResponse);
      }
      storesLogger
        .with({ zaimUserId: token.zaimUserId })
        .debug("Stores cache miss for Zaim user {zaimUserId}, fetching from API");
    } else {
      storesLogger
        .with({ zaimUserId: token.zaimUserId })
        .debug("Stores cache bypassed (no_cache=1) for Zaim user {zaimUserId}");
    }

    const oauthConfig: OAuth1Config = {
      consumerKey: c.env.ZAIM_CONSUMER_KEY,
      consumerSecret: c.env.ZAIM_CONSUMER_SECRET,
      token: token.oauthToken,
      tokenSecret: token.oauthTokenSecret,
    };

    const items = await fetchAllMoneyFromZaim(oauthConfig);

    await buildAndCacheMonthlyData(c.env.ZAIM_KV, token.zaimUserId, items);

    const stores = aggregateStores(items);
    const response: StoresResponse = {
      fetchedAt: new Date().toISOString(),
      stores,
    };

    await c.env.ZAIM_KV.put(storesCacheKey, JSON.stringify(response), {
      expirationTtl: STORES_CACHE_TTL,
    });
    storesLogger
      .with({ zaimUserId: token.zaimUserId, storeCount: stores.length, ttl: STORES_CACHE_TTL })
      .debug("Stores cached for Zaim user {zaimUserId} ({storeCount} stores, TTL={ttl}s)");

    return c.json(response);
  },
);

export const storesRoutes = new Hono<{ Bindings: Env }>().route("/", getStoresRoute);
