import { describe, expect, test } from "vite-plus/test";
import { fitWithin } from "./receiptImage.ts";

describe("fitWithin", () => {
  test("縦長の写真は高さを上限に合わせ、縦横比を保つ", () => {
    expect(fitWithin(3024, 4032)).toEqual({ width: 1200, height: 1600 });
  });

  test("横長の写真は幅を上限に合わせる", () => {
    expect(fitWithin(4000, 3000, 1000)).toEqual({ width: 1000, height: 750 });
  });

  test("上限より小さい画像は大きくしない", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});
