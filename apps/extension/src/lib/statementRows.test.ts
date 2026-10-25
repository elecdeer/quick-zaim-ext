import { describe, expect, test } from "vite-plus/test";
import { buildStatementRows, selectReadableRows } from "./statementRows.ts";

const categories = [
  { id: 101, subCategories: [{ id: 1001 }, { id: 1002 }] },
  { id: 102, subCategories: [{ id: 1003 }] },
];

describe("selectReadableRows", () => {
  test("日付と正の整数の金額がある行だけを残す", () => {
    const rows = selectReadableRows([
      { date: "2026-05-01", place: "店A", placeUid: null, amount: 1000, genreId: 1001 },
      { date: null, place: "日付なし", placeUid: null, amount: 500, genreId: null },
      { date: "2026-05-02", place: "金額なし", placeUid: null, amount: null, genreId: null },
      { date: "2026-05-03", place: "返金", placeUid: null, amount: -300, genreId: null },
      { date: "2026-05-04", place: "小数", placeUid: null, amount: 12.5, genreId: null },
    ]);

    expect(rows.map((row) => row.place)).toEqual(["店A"]);
  });
});

describe("buildStatementRows", () => {
  test("登録済みと判定した行は選択を外し、それ以外は選択する", () => {
    const rows = buildStatementRows({
      rows: [
        { date: "2026-05-01", place: "店A", placeUid: null, amount: 1000, genreId: null },
        { date: "2026-05-02", place: "店B", placeUid: null, amount: 2000, genreId: null },
      ],
      matches: [null, { id: 99, date: "2026-05-02" }],
      recentStores: [],
      categories,
    });

    expect(rows.map((row) => row.selected)).toEqual([true, false]);
    expect(rows[1]?.registered).toEqual({ id: 99, date: "2026-05-02" });
  });

  test("genreId からカテゴリを補完し、該当しなければ未選択にする", () => {
    const rows = buildStatementRows({
      rows: [
        { date: "2026-05-01", place: "店A", placeUid: null, amount: 1000, genreId: 1003 },
        { date: "2026-05-01", place: "店B", placeUid: null, amount: 1000, genreId: 9999 },
      ],
      matches: [null, null],
      recentStores: [],
      categories,
    });

    expect(rows.map((row) => row.category)).toEqual([{ categoryId: 102, genreId: 1003 }, null]);
  });

  test("LLM が推測した店舗 ID が既存店舗にあれば紐付け、なければ店舗名の完全一致で探す", () => {
    const rows = buildStatementRows({
      rows: [
        { date: "2026-05-01", place: "ｱﾏｿﾞﾝ", placeUid: "uid-amazon", amount: 1000, genreId: null },
        { date: "2026-05-01", place: "スーパーA", placeUid: null, amount: 1000, genreId: null },
        {
          date: "2026-05-01",
          place: "初めての店",
          placeUid: "uid-unknown",
          amount: 1000,
          genreId: null,
        },
        { date: "2026-05-01", place: null, placeUid: null, amount: 1000, genreId: null },
      ],
      matches: [null, null, null, null],
      recentStores: [
        { place: "スーパーA", placeUid: "uid-a" },
        { place: "Amazon.co.jp", placeUid: "uid-amazon" },
      ],
      categories,
    });

    expect(rows.map((row) => [row.place, row.store])).toEqual([
      ["ｱﾏｿﾞﾝ", { place: "Amazon.co.jp", placeUid: "uid-amazon" }],
      ["スーパーA", { place: "スーパーA", placeUid: "uid-a" }],
      ["初めての店", null],
      ["", null],
    ]);
  });
});
