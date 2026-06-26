import { moneyGetMoney } from "@repo/zaim-api";
import type { createClient } from "@repo/zaim-api/client";
import type { KVNamespace } from "@cloudflare/workers-types";
import type { Logger } from "../../loggerMiddleware.ts";
import { toZaimApiErrorContext } from "../../zaimApiError.ts";
import type { MoneyItem, MonthlyMoneyCache, StoresResponse } from "./schema.ts";

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

/**
 * Zaim API から全支払いアイテムを取得する。
 */
export const fetchAllMoneyFromZaim = async (
  client: ReturnType<typeof createClient>,
  logger: Logger,
): Promise<MoneyItem[]> => {
  logger.debug("Fetching all money items from Zaim API");

  const result = await moneyGetMoney({
    client,
    query: { mapping: 1, mode: "payment" },
  });

  if (!result.data) {
    logger.error("Failed to fetch money items from Zaim API");
    throw new Error("Failed to fetch money items from Zaim API");
  }

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

  logger
    .with({ itemCount: items.length })
    .debug("Zaim API returned {itemCount} money items with places");

  return items;
};

/**
 * 月別の支払いアイテムを Zaim API から取得する。
 */
export const fetchMonthlyMoneyItems = async (
  client: ReturnType<typeof createClient>,
  yearMonth: string,
  logger: Logger,
): Promise<MoneyItem[]> => {
  const start = `${yearMonth}-01`;
  const end = `${yearMonth}-31`;
  const result = await moneyGetMoney({
    client,
    query: { mapping: 1, mode: "payment", start_date: start, end_date: end },
  });

  if (!result.data) {
    const errCtx = toZaimApiErrorContext(result);
    logger
      .with({ yearMonth, ...errCtx })
      .error(
        "Failed to fetch money items from Zaim API (yearMonth={yearMonth}): {upstreamMessage}",
      );
    throw new Error(`Failed to fetch money items from Zaim API: ${errCtx.upstreamMessage}`);
  }

  const moneyList = result.data.money as ZaimMoneyApiItem[];

  return moneyList.map((m) => ({
    id: m.id,
    date: m.date,
    amount: m.amount,
    place: m.place,
    placeUid: m.place_uid,
    mode: m.mode,
    categoryId: m.category_id,
    genreId: m.genre_id,
  }));
};

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
