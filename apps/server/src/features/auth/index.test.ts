/**
 * auth ルートのテスト
 *
 * /logout  - Cloudflare Access のログアウトエンドポイントへリダイレクト
 * /me      - 認証済みユーザー情報を JSON で返す
 * /auth/launch - 拡張機能向け認証起動（redirect_uri バリデーション）
 */

import { describe, expect, test } from "vite-plus/test";
import type { AccessUser } from "../../access.ts";
import { createTestClient, createTestEnv } from "../../test-fixtures.ts";
import { authRoutes } from "./index.ts";
import type { Env } from "../../env.ts";

const MOCK_USER: AccessUser = { id: "user@example.com", email: "user@example.com" };

const makeEnv = (overrides?: Partial<Env>): Env => createTestEnv(overrides);

// ── /logout ──────────────────────────────────────────────────────────────────

describe("GET /logout", () => {
  test("同一オリジンのCloudflare Accessログアウトにリダイレクトする", async () => {
    const res = await createTestClient(authRoutes, makeEnv()).logout.$get();

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("http://localhost/cdn-cgi/access/logout");
  });
});

// ── /me ──────────────────────────────────────────────────────────────────────

describe("GET /me", () => {
  test("認証済みユーザーのemailとidを返す", async () => {
    const res = await createTestClient(authRoutes, makeEnv(), { user: MOCK_USER }).me.$get();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.email).toBe("user@example.com");
    expect(body.id).toBe("user@example.com");
  });

  test("userが未設定でも200を返す（ミドルウェアで保護済みのため）", async () => {
    const res = await createTestClient(authRoutes, makeEnv()).me.$get();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.email).toBeUndefined();
    expect(body.id).toBeUndefined();
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
