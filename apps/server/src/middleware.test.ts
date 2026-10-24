/**
 * requireAccessUser ミドルウェアのテスト
 *
 * ExecutionContext の ctx.access からユーザーを取り出し、取れなければ Cf-Access-Jwt-Assertion を
 * 検証して取り出す。どちらでも取れなければ 401 を返す。
 */

import { Hono } from "hono";
import type { ExecutionContext } from "hono";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import type { Env } from "./env.ts";
import { loggerMiddleware } from "./loggerMiddleware.ts";
import { requireAccessUser } from "./middleware.ts";
import { ACCESS_TEST_CONFIG, createAccessJwtSigner, createTestEnv } from "./test-fixtures.ts";

const app = new Hono<{ Bindings: Env }>()
  .use(loggerMiddleware)
  .use(requireAccessUser)
  .get("/", (c) => c.json({ user: c.var.user }));

const env = createTestEnv({
  ACCESS_TEAM_DOMAIN: ACCESS_TEST_CONFIG.teamDomain,
  ACCESS_AUD: ACCESS_TEST_CONFIG.aud,
});

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

/** Access の certs エンドポイントが jwks を返すよう fetch を差し替える */
const stubCertsEndpoint = (jwks: unknown) => {
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async () => Response.json(jwks)),
  );
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requireAccessUser", () => {
  test("ctx.access から取り出したユーザーを c.var.user に設定する", async () => {
    const res = await app.request(
      "/",
      {},
      env,
      createExecutionCtx({ getIdentity: async () => ({ email: "user@example.com" }) }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      user: { id: "user@example.com", email: "user@example.com" },
    });
  });

  test("ctx.access がなくても Access の JWT を検証できればユーザーを設定する", async () => {
    const signer = await createAccessJwtSigner();
    stubCertsEndpoint(signer.jwks);

    const res = await app.request(
      "/",
      { headers: { "Cf-Access-Jwt-Assertion": await signer.sign() } },
      env,
      createExecutionCtx(),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      user: { id: "user@example.com", email: "user@example.com" },
    });
  });

  test("ctx.access がなく JWT の検証にも失敗したときは 401 を返す", async () => {
    const trusted = await createAccessJwtSigner();
    const attacker = await createAccessJwtSigner();
    stubCertsEndpoint(trusted.jwks);

    const res = await app.request(
      "/",
      {
        headers: {
          "Cf-Access-Jwt-Assertion": await attacker.sign(),
          // 検証されていないメールのヘッダーは信用しない
          "Cf-Access-Authenticated-User-Email": "user@example.com",
        },
      },
      env,
      createExecutionCtx(),
    );

    expect(res.status).toBe(401);
  });

  test("ctx.access も JWT もないときは 401 を返す", async () => {
    const res = await app.request("/", {}, env, createExecutionCtx());

    expect(res.status).toBe(401);
  });

  test("identity にメールアドレスがなく JWT もないときは 401 を返す", async () => {
    const res = await app.request(
      "/",
      {},
      env,
      createExecutionCtx({ getIdentity: async () => ({}) }),
    );

    expect(res.status).toBe(401);
  });

  test("ExecutionContext がないときは 401 を返す", async () => {
    const res = await app.request("/", {}, env);

    expect(res.status).toBe(401);
  });
});
