import { and, asc, eq, isNotNull, lte, max, sql, sum } from "drizzle-orm";
import { accounts, transactionItems, transactions } from "../../db/schema.ts";
import type { LedgerDb } from "../db.ts";

export type AccountBalance = {
  id: number;
  name: string;
  balance: number;
  /** その日までに最後に動いた日（YYYY-MM-DD）。動いたことがなければ null */
  lastMovedOn: string | null;
};

/**
 * その日までに、口座の列（支払元か入金先）に入っている取引の金額を口座ごとに合計する。
 */
const sumByAccount = (
  db: LedgerDb,
  accountColumn: typeof transactions.fromAccountId | typeof transactions.toAccountId,
  date: string,
) =>
  db
    .select({
      accountId: sql<number>`${accountColumn}`,
      amount: sql<number>`cast(${sum(transactionItems.amount)} as integer)`,
      lastMovedOn: max(transactions.date),
    })
    .from(transactionItems)
    .innerJoin(transactions, eq(transactions.id, transactionItems.transactionId))
    .where(and(isNotNull(accountColumn), lte(transactions.date, date)))
    .groupBy(accountColumn);

/**
 * アーカイブしていない口座ごとに、その日の終わりの残高を並び順で返す。
 *
 * 残高は、入金先がその口座の取引の金額から、支払元がその口座の取引の金額を引いたもの。
 * 種類（支出・収入・振替・残高調整）も集計の設定も問わずにすべて入れる。
 */
export const computeBalances = async (db: LedgerDb, date: string): Promise<AccountBalance[]> => {
  const [accountRows, incoming, outgoing] = await Promise.all([
    db
      .select({ id: accounts.id, name: accounts.name })
      .from(accounts)
      .where(eq(accounts.archived, false))
      .orderBy(asc(accounts.sort), asc(accounts.id)),
    sumByAccount(db, transactions.toAccountId, date),
    sumByAccount(db, transactions.fromAccountId, date),
  ]);
  const incomingById = new Map(incoming.map((row) => [row.accountId, row]));
  const outgoingById = new Map(outgoing.map((row) => [row.accountId, row]));

  return accountRows.map((account) => {
    const received = incomingById.get(account.id);
    const paid = outgoingById.get(account.id);
    const movedDates = [received?.lastMovedOn, paid?.lastMovedOn].filter(
      (value): value is string => typeof value === "string",
    );
    return {
      ...account,
      balance: (received?.amount ?? 0) - (paid?.amount ?? 0),
      lastMovedOn: movedDates.length === 0 ? null : movedDates.reduce((a, b) => (a > b ? a : b)),
    };
  });
};

/**
 * 残高が 0 で、その日までの 1 年間に動いていない口座なら true を返す。画面で「使っていない口座」として畳む。
 */
export const isDormant = (balance: AccountBalance, date: string): boolean => {
  if (balance.balance !== 0) return false;
  if (balance.lastMovedOn === null) return true;
  const oneYearAgo = `${Number(date.slice(0, 4)) - 1}${date.slice(4)}`;
  return balance.lastMovedOn <= oneYearAgo;
};
