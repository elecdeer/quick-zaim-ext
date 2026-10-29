import { describe, expect, test } from "vite-plus/test";
import { isActive, isNavigating, navPath } from "./nav.ts";

describe("isActive", () => {
  test("集計はトップのときだけ選ばれる", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/transactions", "/")).toBe(false);
  });

  test("項目の下のパスでも選ばれる", () => {
    expect(isActive("/transactions", "/transactions")).toBe(true);
    expect(isActive("/transactions/12", "/transactions")).toBe(true);
  });

  test("名前の先頭が同じだけの別のパスでは選ばれない", () => {
    expect(isActive("/transactionsx", "/transactions")).toBe(false);
  });
});

describe("navPath", () => {
  test("何もしていなければ今のパスを返す", () => {
    expect(navPath("/", { state: "idle", location: null, method: null })).toBe("/");
  });

  test("読み込み中なら移動先のパスを返す", () => {
    expect(
      navPath("/", {
        state: "loading",
        location: new URL("http://localhost/transactions?month=2026-10"),
        method: "GET",
      }),
    ).toBe("/transactions");
  });

  test("フォームの送信中は今のパスを返す", () => {
    expect(
      navPath("/transactions/12", {
        state: "submitting",
        location: new URL("http://localhost/transactions/12"),
        method: "POST",
      }),
    ).toBe("/transactions/12");
  });
});

describe("isNavigating", () => {
  test("読み込み中と送信中は true、何もしていなければ false を返す", () => {
    expect(isNavigating({ state: "idle", location: null, method: null })).toBe(false);
    expect(isNavigating({ state: "loading", location: null, method: "GET" })).toBe(true);
    expect(isNavigating({ state: "submitting", location: null, method: "POST" })).toBe(true);
  });
});
