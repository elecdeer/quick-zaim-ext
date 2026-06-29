import type { KVNamespace } from "@cloudflare/workers-types";
import type { CategoriesResponse } from "./schema.ts";

/**
 * KV からキャッシュを取得する。
 */
export const getCachedCategories = async (
  kv: KVNamespace,
  zaimUserId: string,
): Promise<CategoriesResponse | null> => {
  const cached = await kv.get(`zaim:cache:categories:${zaimUserId}`);
  if (!cached) return null;
  return JSON.parse(cached) as CategoriesResponse;
};

/**
 * キャッシュを KV に書き込む。
 */
export const cacheCategories = async (
  kv: KVNamespace,
  zaimUserId: string,
  data: CategoriesResponse,
  ttl: number,
): Promise<void> => {
  await kv.put(`zaim:cache:categories:${zaimUserId}`, JSON.stringify(data), {
    expirationTtl: ttl,
  });
};
