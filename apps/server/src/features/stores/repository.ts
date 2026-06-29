import type { KVNamespace } from "@cloudflare/workers-types";
import type { MonthlyMoneyCache, StoresResponse } from "./schema.ts";

/**
 * KV から店舗キャッシュを取得する。
 */
export const getCachedStores = async (
  kv: KVNamespace,
  zaimUserId: string,
): Promise<StoresResponse | null> => {
  const cached = await kv.get(`zaim:cache:stores:${zaimUserId}`);
  if (!cached) return null;
  return JSON.parse(cached) as StoresResponse;
};

/**
 * 店舗キャッシュを KV に書き込む。
 */
export const cacheStores = async (
  kv: KVNamespace,
  zaimUserId: string,
  data: StoresResponse,
  ttl: number,
): Promise<void> => {
  await kv.put(`zaim:cache:stores:${zaimUserId}`, JSON.stringify(data), { expirationTtl: ttl });
};

/**
 * 月別キャッシュを KV から取得する。
 */
export const getCachedMonthlyMoney = async (
  kv: KVNamespace,
  zaimUserId: string,
  yearMonth: string,
): Promise<MonthlyMoneyCache | null> => {
  const cached = await kv.get(`zaim:cache:money:${zaimUserId}:${yearMonth}`);
  if (!cached) return null;
  return JSON.parse(cached) as MonthlyMoneyCache;
};

/**
 * 月別キャッシュを KV に書き込む。
 */
export const cacheMonthlyMoney = async (
  kv: KVNamespace,
  zaimUserId: string,
  yearMonth: string,
  data: MonthlyMoneyCache,
  ttl: number,
): Promise<void> => {
  await kv.put(`zaim:cache:money:${zaimUserId}:${yearMonth}`, JSON.stringify(data), {
    expirationTtl: ttl,
  });
};

/**
 * 月別キャッシュを KV から削除する。
 */
export const deleteMonthlyMoneyCache = async (
  kv: KVNamespace,
  zaimUserId: string,
  yearMonth: string,
): Promise<void> => {
  await kv.delete(`zaim:cache:money:${zaimUserId}:${yearMonth}`);
};

/**
 * 店舗キャッシュを KV から削除する。
 */
export const deleteStoresCache = async (kv: KVNamespace, zaimUserId: string): Promise<void> => {
  await kv.delete(`zaim:cache:stores:${zaimUserId}`);
};
