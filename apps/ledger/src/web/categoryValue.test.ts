import { describe, expect, test } from "vite-plus/test";
import { categoryLabels, categoryValueOf, parseCategoryValue } from "./categoryValue.ts";

describe("categoryValueOf / parseCategoryValue", () => {
  test.each([
    { categoryId: 1, genreId: 2, value: "g:1:2" },
    { categoryId: 1, genreId: null, value: "c:1" },
    { categoryId: null, genreId: null, value: "" },
  ])("$categoryId と $genreId を $value と相互に変換する", ({ categoryId, genreId, value }) => {
    expect(categoryValueOf(categoryId, genreId)).toBe(value);
    expect(parseCategoryValue(value)).toEqual({ categoryId, genreId });
  });

  test("知らない形の値はカテゴリなしにする", () => {
    expect(parseCategoryValue("x:1")).toEqual({ categoryId: null, genreId: null });
  });
});

describe("categoryLabels", () => {
  test("カテゴリはその名前、内訳はカテゴリと内訳の名前を値から引ける", () => {
    expect(categoryLabels([{ id: 1, name: "食費", genres: [{ id: 2, name: "外食" }] }])).toEqual({
      "c:1": "食費",
      "g:1:2": "食費 / 外食",
    });
  });
});
