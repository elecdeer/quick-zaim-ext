import { describe, expect, test } from "vite-plus/test";
import { setMonthSlide, swipeDirection } from "./monthSlide.ts";

describe("setMonthSlide", () => {
  test("次の月へ進むときは data-month-slide を next にする", () => {
    const root = { dataset: {} };
    setMonthSlide(root, "next");
    expect(root.dataset).toEqual({ monthSlide: "next" });
  });

  test("前の月へ戻るときは前の向きを上書きして prev にする", () => {
    const root = { dataset: { monthSlide: "next" } };
    setMonthSlide(root, "prev");
    expect(root.dataset).toEqual({ monthSlide: "prev" });
  });
});

describe("swipeDirection", () => {
  const start = { x: 200, y: 300, time: 0 };

  test("左へ払うと次の月へ移る", () => {
    expect(swipeDirection(start, { x: 100, y: 310, time: 200 }, 375)).toBe("next");
  });

  test("右へ払うと前の月へ移る", () => {
    expect(swipeDirection(start, { x: 300, y: 290, time: 200 }, 375)).toBe("prev");
  });

  test("横の移動が短ければ移らない", () => {
    expect(swipeDirection(start, { x: 150, y: 300, time: 200 }, 375)).toBeNull();
  });

  test("縦のスクロールが少し横にぶれただけなら移らない", () => {
    expect(swipeDirection(start, { x: 120, y: 120, time: 200 }, 375)).toBeNull();
  });

  test("ゆっくり動かしたときは移らない", () => {
    expect(swipeDirection(start, { x: 100, y: 300, time: 1000 }, 375)).toBeNull();
  });

  test("画面の端から始めたスワイプはブラウザの操作に任せて移らない", () => {
    expect(
      swipeDirection({ x: 10, y: 300, time: 0 }, { x: 200, y: 300, time: 200 }, 375),
    ).toBeNull();
    expect(
      swipeDirection({ x: 365, y: 300, time: 0 }, { x: 200, y: 300, time: 200 }, 375),
    ).toBeNull();
  });
});
