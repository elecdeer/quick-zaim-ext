import type { TransactionFilter } from "../ledger/transactions.ts";

/**
 * 取引の一覧の URL を、絞り込みの条件から作る。指定のない条件はクエリに入れない。
 */
export const transactionsHref = (filter: TransactionFilter): string => {
  const params = new URLSearchParams({ month: filter.month });
  if (filter.mode !== undefined) params.set("mode", filter.mode);
  if (filter.accountId !== undefined) params.set("accountId", String(filter.accountId));
  if (filter.categoryId !== undefined) params.set("categoryId", String(filter.categoryId));
  if (filter.genreId !== undefined) params.set("genreId", String(filter.genreId));
  if (filter.placeId !== undefined) params.set("placeId", String(filter.placeId));
  return `/transactions?${params}`;
};
