import { describe, expect, test } from "vitest";
import { toZaimApiErrorContext } from "./zaimApiError.ts";

describe("toZaimApiErrorContext", () => {
  test("Zaim API が JSON エラー本文を返したケース", () => {
    const ctx = toZaimApiErrorContext({
      data: undefined,
      error: { message: "Invalid parameter", code: 10001 },
      response: { status: 400, statusText: "Bad Request" },
    });

    expect(ctx.upstreamStatus).toBe(400);
    expect(ctx.upstreamBody).toEqual({ message: "Invalid parameter", code: 10001 });
    expect(ctx.upstreamMessage).toContain("HTTP 400");
    expect(ctx.upstreamMessage).toContain("Invalid parameter");
    expect(ctx.upstreamMessage).toContain("10001");
  });

  test("Zaim API が text エラー本文を返したケース", () => {
    const ctx = toZaimApiErrorContext({
      data: undefined,
      error: "internal server error",
      response: { status: 500, statusText: "Internal Server Error" },
    });

    expect(ctx.upstreamStatus).toBe(500);
    expect(ctx.upstreamBody).toBe("internal server error");
    expect(ctx.upstreamMessage).toBe("HTTP 500 Internal Server Error - internal server error");
  });

  test("Error インスタンスを受け取った場合は message を取り出す", () => {
    const ctx = toZaimApiErrorContext({
      data: undefined,
      error: new TypeError("fetch failed"),
      response: undefined,
    });

    expect(ctx.upstreamStatus).toBeUndefined();
    expect(ctx.upstreamBody).toBe("fetch failed");
    expect(ctx.upstreamMessage).toBe("no response from Zaim API - fetch failed");
  });

  test("レスポンスもエラーも無いケース", () => {
    const ctx = toZaimApiErrorContext({ data: undefined });
    expect(ctx.upstreamStatus).toBeUndefined();
    expect(ctx.upstreamBody).toBeUndefined();
    expect(ctx.upstreamMessage).toBe("no response from Zaim API");
  });
});
