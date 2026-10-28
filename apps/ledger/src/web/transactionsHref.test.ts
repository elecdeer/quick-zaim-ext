import { describe, expect, test } from "vite-plus/test";
import { transactionsHref } from "./transactionsHref.ts";

describe("transactionsHref", () => {
  test("月だけなら月だけをクエリに入れる", () => {
    expect(transactionsHref({ month: "2026-10" })).toBe("/transactions?month=2026-10");
  });

  test("指定した条件をすべてクエリに入れる", () => {
    expect(
      transactionsHref({
        month: "2026-10",
        mode: "payment",
        accountId: 1,
        categoryId: 2,
        genreId: 3,
        placeId: 4,
      }),
    ).toBe("/transactions?month=2026-10&mode=payment&accountId=1&categoryId=2&genreId=3&placeId=4");
  });
});
