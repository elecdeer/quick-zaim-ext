import type { KVNamespace } from "@cloudflare/workers-types";
import type { AccountsResponse } from "./schema.ts";

/**
 * KV からキャッシュを取得する。
 */
export const getCachedAccounts = async (
  kv: KVNamespace,
  zaimUserId: string,
): Promise<AccountsResponse | null> => {
  const cached = await kv.get(`zaim:cache:accounts:${zaimUserId}`);
  if (!cached) return null;
  return JSON.parse(cached) as AccountsResponse;
};

/**
 * キャッシュを KV に書き込む。
 */
export const cacheAccounts = async (
  kv: KVNamespace,
  zaimUserId: string,
  data: AccountsResponse,
  ttl: number,
): Promise<void> => {
  await kv.put(`zaim:cache:accounts:${zaimUserId}`, JSON.stringify(data), { expirationTtl: ttl });
};
