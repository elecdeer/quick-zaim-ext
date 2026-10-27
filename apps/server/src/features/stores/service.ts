import type { createClient } from "@repo/zaim-api/client";
import type { KVNamespace } from "@cloudflare/workers-types";
import type { Logger } from "../../loggerMiddleware.ts";
import type { MoneyItem, Store, StoresResponse } from "./schema.ts";
import { fetchAllMoneyFromZaim } from "./external.ts";
import { getCachedStores, cacheStores } from "./repository.ts";

const STORES_CACHE_TTL = 3600;

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

  // ここで取得した支払いは店舗付きのものだけで件数も限られるため、重複チェック用の
  // 月別キャッシュには書き込まない（不完全なキャッシュが登録済みの見落としにつながる）
  const items = await fetchAllMoneyFromZaim(zaimClient, logger);

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
