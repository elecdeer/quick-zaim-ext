import type { BatchItem, BatchResponse } from "drizzle-orm/batch";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import type * as schema from "../db/schema.ts";

/**
 * 台帳の DB。本番では void/db の D1、テストでは node:sqlite を使うので、どちらも受け取れる非同期の SQLite の型にする。
 *
 * batch は D1 と sqlite-proxy のドライバがそれぞれ同じ形で持っていて、共通の型にはないので足す。
 */
export type LedgerDb = BaseSQLiteDatabase<"async", unknown, typeof schema> & {
  batch<U extends BatchItem<"sqlite">, T extends Readonly<[U, ...U[]]>>(
    batch: T,
  ): Promise<BatchResponse<T>>;
};
