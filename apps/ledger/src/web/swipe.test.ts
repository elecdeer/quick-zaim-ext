import { describe, expect, test } from "vite-plus/test";
import { isEdgeStart, lockAxis, monthAfterSwipe, swipeDirectionOf } from "./swipe.ts";

describe("lockAxis", () => {
  test("動きが小さいうちは決めない", () => {
    expect(lockAxis(5, 3)).toBeNull();
  });

  test("横の動きが大きければ横にする", () => {
    expect(lockAxis(-12, 4)).toBe("x");
  });

  test("縦の動きが大きければ縦にする", () => {
    expect(lockAxis(4, 12)).toBe("y");
  });
});

describe("swipeDirectionOf", () => {
  test("左へ十分に払えば left", () => {
    expect(swipeDirectionOf(-80, 10)).toBe("left");
  });

  test("右へ十分に払えば right", () => {
    expect(swipeDirectionOf(80, -10)).toBe("right");
  });

  test("横の移動が短ければスワイプにしない", () => {
    expect(swipeDirectionOf(-40, 0)).toBeNull();
  });

  test("斜めに動かしたときはスワイプにしない", () => {
    expect(swipeDirectionOf(-80, 50)).toBeNull();
  });
});

describe("isEdgeStart", () => {
  test("左右の端から始めたタッチは端とみなす", () => {
    expect(isEdgeStart(10, 390)).toBe(true);
    expect(isEdgeStart(380, 390)).toBe(true);
  });

  test("内側から始めたタッチは端とみなさない", () => {
    expect(isEdgeStart(200, 390)).toBe(false);
  });
});

describe("monthAfterSwipe", () => {
  test("左へ払うと次の月", () => {
    expect(monthAfterSwipe("2026-12", "left")).toBe("2027-01");
  });

  test("右へ払うと前の月", () => {
    expect(monthAfterSwipe("2026-01", "right")).toBe("2025-12");
  });
});
