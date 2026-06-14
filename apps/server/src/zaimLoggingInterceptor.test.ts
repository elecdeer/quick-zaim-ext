import { describe, expect, test, vi } from "vitest";
import type { Logger } from "./loggerMiddleware.ts";
import { createZaimLoggingInterceptors } from "./zaimLoggingInterceptor.ts";

/**
 * `logger.with({...}).info(msg)` という連鎖呼び出しを検証するため、
 * `with` が同じモック自身を返す（`mockReturnThis`）ロガーを作る。
 */
const makeMockLogger = () => {
  const withFn = vi.fn();
  const debug = vi.fn();
  const info = vi.fn();
  const warn = vi.fn();
  const error = vi.fn();
  const logger = { with: withFn, debug, info, warn, error } as unknown as Logger;
  withFn.mockReturnValue(logger);
  return { logger, withFn, debug, info, warn, error };
};

describe("createZaimLoggingInterceptors", () => {
  test("request: method と path を with に含めて debug する", async () => {
    const m = makeMockLogger();
    const { request } = createZaimLoggingInterceptors(m.logger);

    const req = new Request("https://api.zaim.net/v2/home/money/payment?mapping=1", {
      method: "POST",
    });
    const result = await request(req);

    expect(result).toBe(req);
    expect(m.withFn).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/v2/home/money/payment",
        query: "?mapping=1",
      }),
    );
    expect(m.debug).toHaveBeenCalledTimes(1);
  });

  test("response: 2xx のときは info でステータスと本文を出す", async () => {
    const m = makeMockLogger();
    const { response } = createZaimLoggingInterceptors(m.logger);

    const req = new Request("https://api.zaim.net/v2/home/money/payment?mapping=1", {
      method: "POST",
    });
    const res = new Response(JSON.stringify({ money: { id: 1 } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

    const returned = await response(res, req);

    expect(returned).toBe(res);
    expect(m.info).toHaveBeenCalledTimes(1);
    expect(m.warn).not.toHaveBeenCalled();
    expect(m.withFn).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/v2/home/money/payment",
        status: 200,
        body: '{"money":{"id":1}}',
      }),
    );

    // 後段のクライアントが本文を読めることを確認（clone で読んでいるため）
    expect(await res.text()).toBe('{"money":{"id":1}}');
  });

  test("response: 4xx/5xx のときは warn で本文を出す", async () => {
    const m = makeMockLogger();
    const { response } = createZaimLoggingInterceptors(m.logger);

    const req = new Request("https://api.zaim.net/v2/home/money/payment", { method: "POST" });
    const res = new Response('{"error":true,"message":"oauth_problem=token_rejected"}', {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });

    await response(res, req);

    expect(m.warn).toHaveBeenCalledTimes(1);
    expect(m.info).not.toHaveBeenCalled();
    expect(m.withFn).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 401,
        body: '{"error":true,"message":"oauth_problem=token_rejected"}',
      }),
    );
  });

  test("response: 大きい本文は切り詰める", async () => {
    const m = makeMockLogger();
    const { response } = createZaimLoggingInterceptors(m.logger);

    const req = new Request("https://api.zaim.net/v2/home/money", { method: "GET" });
    const huge = "x".repeat(3000);
    const res = new Response(huge, { status: 200 });

    await response(res, req);

    const withArg = m.withFn.mock.calls.at(-1)?.[0] as { body: string };
    expect(withArg.body.length).toBeLessThan(huge.length);
    expect(withArg.body).toContain("truncated");
  });

  test("error: ネットワークエラーを error でログに残す", () => {
    const m = makeMockLogger();
    const { error: errorHandler } = createZaimLoggingInterceptors(m.logger);

    const req = new Request("https://api.zaim.net/v2/home/money", { method: "GET" });
    const err = new TypeError("fetch failed");
    const returned = errorHandler(err, undefined, req);

    expect(returned).toBe(err);
    expect(m.error).toHaveBeenCalledTimes(1);
    expect(m.withFn).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/v2/home/money",
        error: "fetch failed",
      }),
    );
  });
});
