import { describe, expect, test } from "vite-plus/test";
import { groupByDate } from "./groupByDate.ts";

describe("groupByDate", () => {
  test("続く同じ日付の要素を、並び順のまま 1 つにまとめる", () => {
    expect(
      groupByDate([
        { date: "2026-10-20", id: 3 },
        { date: "2026-10-20", id: 2 },
        { date: "2026-10-01", id: 1 },
      ]),
    ).toEqual([
      {
        date: "2026-10-20",
        items: [
          { date: "2026-10-20", id: 3 },
          { date: "2026-10-20", id: 2 },
        ],
      },
      { date: "2026-10-01", items: [{ date: "2026-10-01", id: 1 }] },
    ]);
  });

  test("空の配列には空の配列を返す", () => {
    expect(groupByDate([])).toEqual([]);
  });
});
