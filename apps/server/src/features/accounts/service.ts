import type { createClient } from "@repo/zaim-api/client";
import type { KVNamespace } from "@cloudflare/workers-types";
import type { Logger } from "../../loggerMiddleware.ts";
import type { AccountsResponse } from "./schema.ts";
import { fetchAccountsFromZaim } from "./external.ts";
import { getCachedAccounts, cacheAccounts } from "./repository.ts";

const CACHE_TTL = 86400;

/**
 * 口座一覧を取得する。KV キャッシュがあればそれを返し、なければ Zaim API から取得してキャッシュする。
 */
export const getAccounts = async (params: {
  kv: KVNamespace;
  zaimClient: ReturnType<typeof createClient>;
  zaimUserId: string;
  noCache: boolean;
  logger: Logger;
}): Promise<AccountsResponse> => {
  const { kv, zaimClient, zaimUserId, noCache, logger } = params;

  if (!noCache) {
    const cached = await getCachedAccounts(kv, zaimUserId);
    if (cached) {
      logger.with({ zaimUserId }).debug("Accounts cache hit for Zaim user {zaimUserId}");
      return cached;
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

  await cacheAccounts(kv, zaimUserId, result, CACHE_TTL);
  logger
    .with({ zaimUserId, ttl: CACHE_TTL })
    .debug("Accounts cached for Zaim user {zaimUserId} (TTL={ttl}s)");

  return result;
};
