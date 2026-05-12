/**
 * auth ルートのテスト
 *
 * /logout  - セッション破棄 → Auth0 ログアウト URL へリダイレクト
 * /me      - 認証済みユーザー情報を JSON で返す
 * /auth/launch - 拡張機能向け認証起動（redirect_uri バリデーション）
 */

import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { createKVNamespaceMock, createTestClient } from "../test-fixtures.ts";
import { authRoutes } from "./auth.ts";
import type { Env } from "../env.ts";
import type { OidcAuth } from "@hono/oidc-auth";

vi.mock("@hono/oidc-auth", () => ({
  revokeSession: vi.fn().mockResolvedValue(undefined),
}));

import { revokeSession } from "@hono/oidc-auth";

const mockRevokeSession = vi.mocked(revokeSession);

const MOCK_USER = {
  sub: "auth0|user123",
  email: "user@example.com",
  rtk: "",
  rtkexp: 9999999999,
  ssnexp: 9999999999,
} as OidcAuth;

beforeEach(() => {
  vi.clearAllMocks();
});

function makeEnv(overrides?: Partial<Env>): Env {
  const { kv } = createKVNamespaceMock();
  return {
    OIDC_ISSUER: "https://example.auth0.com/",
    OIDC_CLIENT_ID: "test_client_id",
    OIDC_CLIENT_SECRET: "test_client_secret",
    OIDC_REDIRECT_URI: "https://example.com/callback",
    OIDC_AUTH_SECRET: "test_auth_secret_32chars_minimum!",
    ZAIM_CONSUMER_KEY: "zaim_consumer_key",
    ZAIM_CONSUMER_SECRET: "zaim_consumer_secret",
    ZAIM_KV: kv,
    ...overrides,
  };
}

// ── /logout ──────────────────────────────────────────────────────────────────

describe("GET /logout", () => {
  beforeEach(() => {
    mockRevokeSession.mockResolvedValue(undefined as unknown as void);
  });

  test("Auth0のログアウトURLにリダイレクトする", async () => {
    const res = await createTestClient(authRoutes, makeEnv()).logout.$get();

    expect(res.status).toBe(302);
    const location = res.headers.get("Location") ?? "";
    expect(location).toContain("example.auth0.com");
    expect(location).toContain("v2/logout");
    expect(location).toContain("client_id=test_client_id");
  });

  test("ログアウトURL末尾スラッシュが重複しない", async () => {
    const res = await createTestClient(
      authRoutes,
      makeEnv({ OIDC_ISSUER: "https://example.auth0.com/" }),
    ).logout.$get();
    const location = res.headers.get("Location") ?? "";
    expect(location).not.toContain("auth0.com//");
  });

  test("revokeSessionを呼び出す", async () => {
    await createTestClient(authRoutes, makeEnv()).logout.$get();
    expect(mockRevokeSession).toHaveBeenCalledOnce();
  });
});

// ── /me ──────────────────────────────────────────────────────────────────────

describe("GET /me", () => {
  test("認証済みユーザーのemailとsubを返す", async () => {
    const res = await createTestClient(authRoutes, makeEnv(), { oidcAuth: MOCK_USER }).me.$get();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.email).toBe("user@example.com");
    expect(body.sub).toBe("auth0|user123");
  });

  test("getAuthがnullを返しても200を返す（ミドルウェアで保護済みのため）", async () => {
    const res = await createTestClient(authRoutes, makeEnv(), { oidcAuth: null }).me.$get();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.email).toBeUndefined();
    expect(body.sub).toBeUndefined();
  });
});

// ── /auth/launch ─────────────────────────────────────────────────────────────

describe("GET /auth/launch", () => {
  test("有効なchromiumapp.orgのredirect_uriにリダイレクトする", async () => {
    const redirectUri = "https://abcdef.chromiumapp.org/callback";
    const res = await createTestClient(authRoutes, makeEnv()).auth.launch.$get({
      query: { redirect_uri: redirectUri },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(redirectUri);
  });

  test("redirect_uriが未指定のとき400を返す", async () => {
    const res = await authRoutes.request("http://localhost/auth/launch", {}, makeEnv());
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBeDefined();
  });

  test("chromiumapp.org以外のhostは400を返す", async () => {
    const res = await createTestClient(authRoutes, makeEnv()).auth.launch.$get({
      query: { redirect_uri: "https://evil.example.com/cb" },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/redirect_uri/);
  });

  test("httpスキームのURIは400を返す", async () => {
    const res = await createTestClient(authRoutes, makeEnv()).auth.launch.$get({
      query: { redirect_uri: "http://abc.chromiumapp.org/cb" },
    });
    expect(res.status).toBe(400);
  });
});
