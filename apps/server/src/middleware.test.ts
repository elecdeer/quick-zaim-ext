/**
 * requireAccessUser ミドルウェアのテスト
 *
 * ExecutionContext の ctx.access からユーザーを取り出し、取れなければ 401 を返す。
 */

import { Hono } from "hono";
import type { ExecutionContext } from "hono";
import { describe, expect, test, vi } from "vite-plus/test";
import { requireAccessUser } from "./middleware.ts";

const app = new Hono().use(requireAccessUser).get("/", (c) => c.json({ user: c.var.user }));

/**
 * Hono に渡す ExecutionContext を作る。access を渡したときだけ ctx.access を持たせる。
 */
const createExecutionCtx = (access?: { getIdentity: () => Promise<unknown> }): ExecutionContext => {
  const ctx = {
    waitUntil: vi.fn<(promise: Promise<unknown>) => void>(),
    passThroughOnException: vi.fn<() => void>(),
    props: {},
    ...(access ? { access } : {}),
  };
  return ctx;
};

describe("requireAccessUser", () => {
  test("ctx.access から取り出したユーザーを c.var.user に設定する", async () => {
    const res = await app.request(
      "/",
      {},
      {},
      createExecutionCtx({ getIdentity: async () => ({ email: "user@example.com" }) }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      user: { id: "user@example.com", email: "user@example.com" },
    });
  });

  test("ctx.access がないときは 401 を返す", async () => {
    const res = await app.request("/", {}, {}, createExecutionCtx());

    expect(res.status).toBe(401);
  });

  test("identity にメールアドレスがないときは 401 を返す", async () => {
    const res = await app.request(
      "/",
      {},
      {},
      createExecutionCtx({ getIdentity: async () => ({}) }),
    );

    expect(res.status).toBe(401);
  });

  test("ExecutionContext がないときは 401 を返す", async () => {
    const res = await app.request("/");

    expect(res.status).toBe(401);
  });
});
