import type { createClient as createZaimClient } from "@repo/zaim-api/client";
import type { KVNamespace } from "@cloudflare/workers-types";
import type { Logger } from "../../loggerMiddleware.ts";
import type { MoneyItem, MonthlyMoneyCache } from "../stores/schema.ts";
import { fetchMonthlyMoneyItems } from "../stores/external.ts";
import {
  getCachedMonthlyMoney,
  cacheMonthlyMoney,
  deleteMonthlyMoneyCache,
  deleteStoresCache,
} from "../stores/repository.ts";
import { createPayment } from "./external.ts";

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
 * 指定月の支払いアイテムを KV キャッシュから、なければ Zaim API から取得してキャッシュする。
 */
const loadMonthlyMoneyItems = async (params: {
  kv: KVNamespace;
  zaimClient: ReturnType<typeof createZaimClient>;
  zaimUserId: string;
  yearMonth: string;
  logger: Logger;
}): Promise<MoneyItem[]> => {
  const { kv, zaimClient, zaimUserId, yearMonth, logger } = params;

  const cached = await getCachedMonthlyMoney(kv, zaimUserId, yearMonth);
  if (cached) {
    logger.with({ zaimUserId, yearMonth }).debug("Monthly money cache hit ({yearMonth})");
    return cached.items;
  }

  logger
    .with({ zaimUserId, yearMonth })
    .debug("Monthly money cache miss ({yearMonth}), fetching from API");
  const items = await fetchMonthlyMoneyItems(zaimClient, yearMonth, logger);
  const cache: MonthlyMoneyCache = { fetchedAt: new Date().toISOString(), items };
  await cacheMonthlyMoney(kv, zaimUserId, yearMonth, cache, CURRENT_MONTH_MONEY_TTL);
  return items;
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

  const items = await loadMonthlyMoneyItems({
    kv,
    zaimClient,
    zaimUserId,
    yearMonth: yearMonthOf(date),
    logger,
  });

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

/** 一括登録の登録済み判定で同一とみなす日付のずれ（日） */
export const BULK_DUPLICATE_TOLERANCE_DAYS = 2;

const DAY_MS = 24 * 60 * 60 * 1000;

const diffDays = (a: string, b: string): number =>
  Math.round((Date.parse(a) - Date.parse(b)) / DAY_MS);

export type BulkDuplicateEntry = { date: string; amount: number };

/**
 * 明細の各行に、既に登録されている支払いを 1 対 1 で割り当てる。
 *
 * 金額が一致し日付のずれが `toleranceDays` 以内のものを候補とし、ずれの小さい組から
 * 順に確定させる。同じ日に同額の利用が 2 回あって片方しか登録されていない場合に、
 * 両方を登録済みと誤判定しないよう、1 件の既存支払いは 1 行にしか割り当てない。
 * カテゴリや口座は手入力時と異なることがあるため判定に使わない。
 *
 * @returns `entries` と同じ順序で、割り当てられた既存支払い（なければ null）
 */
export const matchRegisteredEntries = (
  entries: ReadonlyArray<BulkDuplicateEntry>,
  items: ReadonlyArray<MoneyItem>,
  toleranceDays: number = BULK_DUPLICATE_TOLERANCE_DAYS,
): Array<MoneyItem | null> => {
  const candidates: Array<{ entryIndex: number; itemIndex: number; distance: number }> = [];
  entries.forEach((entry, entryIndex) => {
    items.forEach((item, itemIndex) => {
      if (item.mode !== "payment" || item.amount !== entry.amount) return;
      const distance = Math.abs(diffDays(item.date, entry.date));
      if (distance <= toleranceDays) candidates.push({ entryIndex, itemIndex, distance });
    });
  });
  // Array.prototype.sort は安定ソートなので、同じずれなら明細の並び順・既存支払いの並び順を保つ
  candidates.sort((a, b) => a.distance - b.distance);

  const matches: Array<MoneyItem | null> = entries.map(() => null);
  const usedItems = new Set<number>();
  for (const { entryIndex, itemIndex } of candidates) {
    if (matches[entryIndex] !== null || usedItems.has(itemIndex)) continue;
    matches[entryIndex] = items[itemIndex] ?? null;
    usedItems.add(itemIndex);
  }
  return matches;
};

/**
 * 明細の各行について、既に登録済みの支払いを検索する。
 *
 * 各行の日付 ±`BULK_DUPLICATE_TOLERANCE_DAYS` 日が含まれる月をまとめて読み込んでから判定する。
 */
export const findRegisteredEntries = async (params: {
  kv: KVNamespace;
  zaimClient: ReturnType<typeof createZaimClient>;
  zaimUserId: string;
  entries: ReadonlyArray<BulkDuplicateEntry>;
  logger: Logger;
}): Promise<Array<MoneyItem | null>> => {
  const { kv, zaimClient, zaimUserId, entries, logger } = params;

  const yearMonths = new Set<string>();
  for (const entry of entries) {
    yearMonths.add(yearMonthOf(addDays(entry.date, -BULK_DUPLICATE_TOLERANCE_DAYS)));
    yearMonths.add(yearMonthOf(addDays(entry.date, BULK_DUPLICATE_TOLERANCE_DAYS)));
  }

  // 月ごとの取得は Zaim API を叩き得るので、並列にせず順に読む
  const items: MoneyItem[] = [];
  for (const yearMonth of [...yearMonths].sort()) {
    items.push(...(await loadMonthlyMoneyItems({ kv, zaimClient, zaimUserId, yearMonth, logger })));
  }

  const matches = matchRegisteredEntries(entries, items);

  logger
    .with({
      zaimUserId,
      entryCount: entries.length,
      matchedCount: matches.filter((m) => m !== null).length,
    })
    .debug("Bulk duplicate check matched {matchedCount}/{entryCount} entries");

  return matches;
};
