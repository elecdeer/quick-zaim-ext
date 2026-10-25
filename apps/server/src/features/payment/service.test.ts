/**
 * matchRegisteredEntries のテスト
 *
 * 明細の各行に既存の支払いを 1 対 1 で割り当てる純粋関数。
 */

import { describe, expect, test } from "vite-plus/test";
import type { MoneyItem } from "../stores/schema.ts";
import { matchRegisteredEntries } from "./service.ts";

const moneyItem = (overrides: Partial<MoneyItem> & Pick<MoneyItem, "id">): MoneyItem => ({
  date: "2026-05-19",
  amount: 1500,
  place: "",
  placeUid: "",
  mode: "payment",
  categoryId: 101,
  genreId: 201,
  ...overrides,
});

describe("matchRegisteredEntries", () => {
  test("金額が一致し日付のずれが2日以内なら登録済みとして割り当てる", () => {
    const items = [moneyItem({ id: 1, date: "2026-05-21" })];

    const matches = matchRegisteredEntries([{ date: "2026-05-19", amount: 1500 }], items);

    expect(matches.map((m) => m?.id ?? null)).toEqual([1]);
  });

  test("日付のずれが3日以上なら割り当てない", () => {
    const items = [moneyItem({ id: 1, date: "2026-05-22" })];

    const matches = matchRegisteredEntries([{ date: "2026-05-19", amount: 1500 }], items);

    expect(matches).toEqual([null]);
  });

  test("金額が異なれば割り当てない", () => {
    const items = [moneyItem({ id: 1, amount: 1501 })];

    const matches = matchRegisteredEntries([{ date: "2026-05-19", amount: 1500 }], items);

    expect(matches).toEqual([null]);
  });

  test("カテゴリが異なっていても割り当てる", () => {
    const items = [moneyItem({ id: 1, categoryId: 999, genreId: 9999 })];

    const matches = matchRegisteredEntries([{ date: "2026-05-19", amount: 1500 }], items);

    expect(matches.map((m) => m?.id ?? null)).toEqual([1]);
  });

  test("月をまたいでも日付のずれが2日以内なら割り当てる", () => {
    const items = [moneyItem({ id: 1, date: "2026-06-01" })];

    const matches = matchRegisteredEntries([{ date: "2026-05-30", amount: 1500 }], items);

    expect(matches.map((m) => m?.id ?? null)).toEqual([1]);
  });

  test("1件の既存支払いは1行にしか割り当てない", () => {
    const items = [moneyItem({ id: 1 })];

    const matches = matchRegisteredEntries(
      [
        { date: "2026-05-19", amount: 1500 },
        { date: "2026-05-19", amount: 1500 },
      ],
      items,
    );

    expect(matches.map((m) => m?.id ?? null)).toEqual([1, null]);
  });

  test("日付のずれが小さい組から優先して割り当てる", () => {
    // 1行目は既存の両方と候補になるが、2行目と日付が完全一致する id=2 は2行目に回す
    const items = [
      moneyItem({ id: 1, date: "2026-05-18" }),
      moneyItem({ id: 2, date: "2026-05-20" }),
    ];

    const matches = matchRegisteredEntries(
      [
        { date: "2026-05-19", amount: 1500 },
        { date: "2026-05-20", amount: 1500 },
      ],
      items,
    );

    expect(matches.map((m) => m?.id ?? null)).toEqual([1, 2]);
  });

  test("payment 以外の既存アイテムは割り当てない", () => {
    const items = [moneyItem({ id: 1, mode: "income" })];

    const matches = matchRegisteredEntries([{ date: "2026-05-19", amount: 1500 }], items);

    expect(matches).toEqual([null]);
  });
});
