import { describe, expect, test } from "vite-plus/test";
import { formatDay, formatPercent, formatYen } from "./format.ts";

describe("formatYen", () => {
  test("3 桁ごとに区切って円記号を付ける", () => {
    expect(formatYen(1234567)).toBe("¥1,234,567");
  });

  test("負の金額は符号を円記号の前に付ける", () => {
    expect(formatYen(-500)).toBe("-¥500");
  });
});

describe("formatPercent", () => {
  test("小数第 1 位までの割合にする", () => {
    expect(formatPercent(1, 3)).toBe("33.3%");
  });

  test("全体が 0 なら空にする", () => {
    expect(formatPercent(0, 0)).toBe("");
  });
});

describe("formatDay", () => {
  test("月/日と曜日を書く", () => {
    expect(formatDay("2026-10-28")).toBe("10/28（水）");
  });
});
