import type { createClient as createZaimClient } from "@repo/zaim-api/client";
import type { KVNamespace } from "@cloudflare/workers-types";
import type { Logger } from "../../loggerMiddleware.ts";
import type { MoneyItem, MonthlyMoneyCache } from "../stores/schema.ts";
import {
  fetchMonthlyMoneyItems,
  getCachedMonthlyMoney,
  cacheMonthlyMoney,
  deleteMonthlyMoneyCache,
  deleteStoresCache,
} from "../stores/repository.ts";
import { createPayment } from "./repository.ts";

const CURRENT_MONTH_MONEY_TTL = 3600;

const yearMonthOf = (date: string): string => date.slice(0, 7);

const addDays = (dateStr: string, days: number): string => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

type RegisterPaymentParams = {
  category_id: number;
  genre_id: number;
  amount: number;
  date: string;
  from_account_id?: number;
  comment?: string;
  name?: string;
  place?: string;
  place_uid?: string;
};

type RegisterPaymentResult =
  | {
      success: true;
      data: { id: number; modified: string; placeUid?: string };
    }
  | {
      success: false;
      error: { upstreamStatus: number | undefined; upstreamMessage: string };
    };

/**
 * 支払いを Zaim に登録し、関連キャッシュを無効化する。
 */
export const registerPayment = async (params: {
  kv: KVNamespace;
  zaimClient: ReturnType<typeof createZaimClient>;
  zaimUserId: string;
  body: RegisterPaymentParams;
  logger: Logger;
}): Promise<RegisterPaymentResult> => {
  const { kv, zaimClient, zaimUserId, body, logger } = params;

  logger.with({ zaimUserId, body }).debug("Registering payment for Zaim {*}");

  const result = await createPayment(zaimClient, body, logger);

  if (!result.success) {
    return result;
  }

  const yearMonth = yearMonthOf(body.date);
  await Promise.all([
    deleteMonthlyMoneyCache(kv, zaimUserId, yearMonth),
    deleteStoresCache(kv, zaimUserId),
  ]);

  logger
    .with({ zaimUserId, id: result.data.id })
    .debug("Payment registered for Zaim user {zaimUserId}, id={id}");

  return result;
};

/**
 * 指定条件に一致する重複候補を検索する。
 */
export const checkDuplicates = async (params: {
  kv: KVNamespace;
  zaimClient: ReturnType<typeof createZaimClient>;
  zaimUserId: string;
  date: string;
  amount: number;
  genreId: number;
  logger: Logger;
}): Promise<MoneyItem[]> => {
  const { kv, zaimClient, zaimUserId, date, amount, genreId, logger } = params;

  const yearMonth = yearMonthOf(date);

  let items: MoneyItem[];

  const cached = await getCachedMonthlyMoney(kv, zaimUserId, yearMonth);
  if (cached) {
    logger
      .with({ zaimUserId, yearMonth })
      .debug("Monthly money cache hit for duplicate check ({yearMonth})");
    items = cached.items;
  } else {
    logger
      .with({ zaimUserId, yearMonth })
      .debug("Monthly money cache miss for duplicate check ({yearMonth}), fetching from API");
    items = await fetchMonthlyMoneyItems(zaimClient, yearMonth, logger);
    const cache: MonthlyMoneyCache = { fetchedAt: new Date().toISOString(), items };
    await cacheMonthlyMoney(kv, zaimUserId, yearMonth, cache, CURRENT_MONTH_MONEY_TTL);
  }

  const minDate = addDays(date, -1);
  const maxDate = addDays(date, 1);

  const duplicates = items.filter(
    (item) =>
      item.genreId === genreId &&
      item.amount === amount &&
      item.date >= minDate &&
      item.date <= maxDate,
  );

  logger
    .with({ zaimUserId, duplicateCount: duplicates.length })
    .debug("Duplicate check found {duplicateCount} potential duplicates");

  return duplicates;
};
