import type { DatabaseSync } from "node:sqlite";
import { describe, expect, test } from "vite-plus/test";
import { createTestLedgerDb, insert } from "../../db/testing.ts";
import { computeBalances, isDormant } from "./balances.ts";

/**
 * 品目の金額を並べた取引を入れる。
 */
const insertTransaction = (
  sqlite: DatabaseSync,
  params: {
    date: string;
    mode: string;
    from?: number;
    to?: number;
    aggregation?: string;
    amounts: number[];
  },
): void => {
  const id = insert(
    sqlite,
    "INSERT INTO transactions (date, mode, from_account_id, to_account_id, aggregation, source) VALUES (?, ?, ?, ?, ?, 'manual')",
    params.date,
    params.mode,
    params.from ?? null,
    params.to ?? null,
    params.aggregation ?? "always",
  );
  for (const amount of params.amounts) {
    insert(
      sqlite,
      "INSERT INTO transaction_items (transaction_id, amount) VALUES (?, ?)",
      id,
      amount,
    );
  }
};

describe("computeBalances", () => {
  test("入ってきた金額から出ていった金額を引き、種類と集計の設定を問わずに合計する", async () => {
    const { db, sqlite } = createTestLedgerDb();
    const wallet = insert(sqlite, "INSERT INTO accounts (name, sort) VALUES ('財布', 1)");
    const bank = insert(sqlite, "INSERT INTO accounts (name, sort) VALUES ('銀行', 0)");
    insertTransaction(sqlite, { date: "2026-09-25", mode: "income", to: bank, amounts: [300000] });
    insertTransaction(sqlite, {
      date: "2026-10-01",
      mode: "transfer",
      from: bank,
      to: wallet,
      amounts: [20000],
    });
    insertTransaction(sqlite, {
      date: "2026-10-02",
      mode: "payment",
      from: wallet,
      amounts: [1000, -100],
    });
    insertTransaction(sqlite, {
      date: "2026-10-03",
      mode: "payment",
      from: wallet,
      aggregation: "never",
      amounts: [500],
    });
    insertTransaction(sqlite, {
      date: "2026-10-04",
      mode: "adjustment",
      from: wallet,
      amounts: [40],
    });
    insertTransaction(sqlite, { date: "2026-10-05", mode: "adjustment", to: bank, amounts: [7] });

    expect(await computeBalances(db, "2026-10-31")).toEqual([
      { id: bank, name: "銀行", balance: 280007, lastMovedOn: "2026-10-05" },
      { id: wallet, name: "財布", balance: 18560, lastMovedOn: "2026-10-04" },
    ]);
  });

  test("指定した日より後の取引は入れない", async () => {
    const { db, sqlite } = createTestLedgerDb();
    const wallet = insert(sqlite, "INSERT INTO accounts (name) VALUES ('財布')");
    insertTransaction(sqlite, { date: "2026-10-01", mode: "income", to: wallet, amounts: [1000] });
    insertTransaction(sqlite, {
      date: "2026-10-02",
      mode: "payment",
      from: wallet,
      amounts: [300],
    });

    expect(await computeBalances(db, "2026-10-01")).toEqual([
      { id: wallet, name: "財布", balance: 1000, lastMovedOn: "2026-10-01" },
    ]);
  });

  test("動いたことのない口座は残高 0 にし、アーカイブした口座は返さない", async () => {
    const { db, sqlite } = createTestLedgerDb();
    const unused = insert(sqlite, "INSERT INTO accounts (name) VALUES ('使っていない口座')");
    insert(sqlite, "INSERT INTO accounts (name, archived) VALUES ('解約した口座', 1)");

    expect(await computeBalances(db, "2026-10-31")).toEqual([
      { id: unused, name: "使っていない口座", balance: 0, lastMovedOn: null },
    ]);
  });
});

describe("isDormant", () => {
  const account = { id: 1, name: "口座" };

  test("残高が 0 で 1 年以上動いていなければ使っていない口座とする", () => {
    expect(isDormant({ ...account, balance: 0, lastMovedOn: "2025-10-29" }, "2026-10-29")).toBe(
      true,
    );
  });

  test("動いたことがなく残高が 0 なら使っていない口座とする", () => {
    expect(isDormant({ ...account, balance: 0, lastMovedOn: null }, "2026-10-29")).toBe(true);
  });

  test("1 年以内に動いていれば使っている口座とする", () => {
    expect(isDormant({ ...account, balance: 0, lastMovedOn: "2025-10-30" }, "2026-10-29")).toBe(
      false,
    );
  });

  test("残高があれば使っている口座とする", () => {
    expect(isDormant({ ...account, balance: 1, lastMovedOn: "2020-01-01" }, "2026-10-29")).toBe(
      false,
    );
  });
});
