import { describe, expect, test } from "vite-plus/test";
import { buildStatementRows, selectReadableRows } from "./statementRows.ts";

const categories = [
  { id: 101, subCategories: [{ id: 1001 }, { id: 1002 }] },
  { id: 102, subCategories: [{ id: 1003 }] },
];

describe("selectReadableRows", () => {
  test("日付と正の整数の金額がある行だけを残す", () => {
    const rows = selectReadableRows([
      { date: "2026-05-01", place: "店A", amount: 1000, genreId: 1001 },
      { date: null, place: "日付なし", amount: 500, genreId: null },
      { date: "2026-05-02", place: "金額なし", amount: null, genreId: null },
      { date: "2026-05-03", place: "返金", amount: -300, genreId: null },
      { date: "2026-05-04", place: "小数", amount: 12.5, genreId: null },
    ]);

    expect(rows.map((row) => row.place)).toEqual(["店A"]);
  });
});

describe("buildStatementRows", () => {
  test("登録済みと判定した行は選択を外し、それ以外は選択する", () => {
    const rows = buildStatementRows({
      rows: [
        { date: "2026-05-01", place: "店A", amount: 1000, genreId: null },
        { date: "2026-05-02", place: "店B", amount: 2000, genreId: null },
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
        { date: "2026-05-01", place: "店A", amount: 1000, genreId: 1003 },
        { date: "2026-05-01", place: "店B", amount: 1000, genreId: 9999 },
      ],
      matches: [null, null],
      recentStores: [],
      categories,
    });

    expect(rows.map((row) => row.category)).toEqual([{ categoryId: 102, genreId: 1003 }, null]);
  });

  test("最近の店舗と名前が一致すれば店舗 ID を引き継ぐ", () => {
    const rows = buildStatementRows({
      rows: [
        { date: "2026-05-01", place: "スーパーA", amount: 1000, genreId: null },
        { date: "2026-05-01", place: "初めての店", amount: 1000, genreId: null },
        { date: "2026-05-01", place: null, amount: 1000, genreId: null },
      ],
      matches: [null, null, null],
      recentStores: [{ place: "スーパーA", placeUid: "uid-a" }],
      categories,
    });

    expect(rows.map((row) => [row.place, row.placeUid])).toEqual([
      ["スーパーA", "uid-a"],
      ["初めての店", ""],
      ["", ""],
    ]);
  });
});
