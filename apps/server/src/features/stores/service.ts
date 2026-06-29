import type { createClient } from "@repo/zaim-api/client";
import type { KVNamespace } from "@cloudflare/workers-types";
import type { Logger } from "../../loggerMiddleware.ts";
import type { MoneyItem, Store, StoresResponse, MonthlyMoneyCache } from "./schema.ts";
import { fetchAllMoneyFromZaim } from "./external.ts";
import { getCachedStores, cacheStores, cacheMonthlyMoney } from "./repository.ts";

const STORES_CACHE_TTL = 3600;
const CURRENT_MONTH_MONEY_TTL = 3600;
const PAST_MONTH_MONEY_TTL = 2592000;

const currentYearMonth = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const yearMonthOf = (date: string): string => date.slice(0, 7);

/**
 * 支払いアイテムから店舗一覧を集約する。
 */
export const aggregateStores = (items: MoneyItem[]): Store[] => {
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
};

/**
 * 取得した支払いアイテムを月別に分割して KV にキャッシュする。
 */
export const buildAndCacheMonthlyData = async (
  kv: KVNamespace,
  zaimUserId: string,
  items: MoneyItem[],
  logger: Logger,
): Promise<void> => {
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
    const ttl = ym < thisMonth ? PAST_MONTH_MONEY_TTL : CURRENT_MONTH_MONEY_TTL;
    const value: MonthlyMoneyCache = { fetchedAt, items: monthItems };
    puts.push(cacheMonthlyMoney(kv, zaimUserId, ym, value, ttl));
  }

  await Promise.all(puts);

  logger
    .with({ zaimUserId, monthCount: byMonth.size })
    .debug("Cached {monthCount} monthly money caches for Zaim user {zaimUserId}");
};

/**
 * 店舗一覧を取得する。KV キャッシュがあればそれを返し、なければ Zaim API から取得して集約・キャッシュする。
 */
export const getStores = async (params: {
  kv: KVNamespace;
  zaimClient: ReturnType<typeof createClient>;
  zaimUserId: string;
  noCache: boolean;
  logger: Logger;
}): Promise<StoresResponse> => {
  const { kv, zaimClient, zaimUserId, noCache, logger } = params;

  if (!noCache) {
    const cached = await getCachedStores(kv, zaimUserId);
    if (cached) {
      logger.with({ zaimUserId }).debug("Stores cache hit for Zaim user {zaimUserId}");
      return cached;
    }
    logger
      .with({ zaimUserId })
      .debug("Stores cache miss for Zaim user {zaimUserId}, fetching from API");
  } else {
    logger
      .with({ zaimUserId })
      .debug("Stores cache bypassed (no_cache=1) for Zaim user {zaimUserId}");
  }

  const items = await fetchAllMoneyFromZaim(zaimClient, logger);

  await buildAndCacheMonthlyData(kv, zaimUserId, items, logger);

  const stores = aggregateStores(items);
  const response: StoresResponse = {
    fetchedAt: new Date().toISOString(),
    stores,
  };

  await cacheStores(kv, zaimUserId, response, STORES_CACHE_TTL);
  logger
    .with({ zaimUserId, storeCount: stores.length, ttl: STORES_CACHE_TTL })
    .debug("Stores cached for Zaim user {zaimUserId} ({storeCount} stores, TTL={ttl}s)");

  return response;
};
