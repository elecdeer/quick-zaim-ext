import type { createClient } from "@repo/zaim-api/client";
import type { KVNamespace } from "@cloudflare/workers-types";
import type { Logger } from "../../loggerMiddleware.ts";
import type { CategoriesResponse } from "./schema.ts";
import { fetchCategoriesFromZaim } from "./external.ts";
import { getCachedCategories, cacheCategories } from "./repository.ts";

const CACHE_TTL = 86400;

/**
 * カテゴリ＋サブカテゴリ一覧を取得する。KV キャッシュがあればそれを返し、なければ Zaim API から取得してキャッシュする。
 */
export const getCategories = async (params: {
  kv: KVNamespace;
  zaimClient: ReturnType<typeof createClient>;
  zaimUserId: string;
  noCache: boolean;
  logger: Logger;
}): Promise<CategoriesResponse> => {
  const { kv, zaimClient, zaimUserId, noCache, logger } = params;

  if (!noCache) {
    const cached = await getCachedCategories(kv, zaimUserId);
    if (cached) {
      logger.with({ zaimUserId }).debug("Categories cache hit for Zaim user {zaimUserId}");
      return cached;
    }
    logger
      .with({ zaimUserId })
      .debug("Categories cache miss for Zaim user {zaimUserId}, fetching from API");
  } else {
    logger
      .with({ zaimUserId })
      .debug("Categories cache bypassed (no_cache=1) for Zaim user {zaimUserId}");
  }

  const result = await fetchCategoriesFromZaim(zaimClient, logger);

  await cacheCategories(kv, zaimUserId, result, CACHE_TTL);
  logger
    .with({ zaimUserId, ttl: CACHE_TTL })
    .debug("Categories cached for Zaim user {zaimUserId} (TTL={ttl}s)");

  return result;
};
