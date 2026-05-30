/**
 * accounts ルートのテスト
 *
 * GET /api/zaim/accounts - 支払い方法（口座）一覧（KVキャッシュ付き）
 */

import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { createKVNamespaceMock, createTestClient, createZaimClientStub } from "../test-fixtures.ts";
import { accountsRoutes } from "./accounts.ts";
import type { Env } from "../env.ts";
import type { KVNamespace } from "@cloudflare/workers-types";
import type { OidcAuth } from "@hono/oidc-auth";

const { mockGetAccounts } = vi.hoisted(() => ({
  mockGetAccounts: vi.fn(),
}));

vi.mock("@repo/zaim-api", () => ({
  accountGetAccounts: mockGetAccounts,
}));

const MOCK_USER = {
  sub: "auth0|user123",
  email: "user@example.com",
  rtk: "",
  rtkexp: 9999999999,
  ssnexp: 9999999999,
} as OidcAuth;

const MOCK_ACCOUNTS_RESPONSE = {
  accounts: [
    {
      id: 1,
      name: "現金",
      modified: "2026-01-01",
      sort: 0,
      active: 1,
      local_id: 0,
      website_id: 0,
      parent_account_id: 0,
    },
    {
      id: 2,
      name: "クレジットカード",
      modified: "2026-01-02",
      sort: 1,
      active: 1,
      local_id: 0,
      website_id: 0,
      parent_account_id: 0,
    },
  ],
};

const makeEnv = (kvOverride?: KVNamespace): Env => {
  const { kv } = createKVNamespaceMock();
  return {
    OIDC_ISSUER: "https://example.auth0.com/",
    OIDC_CLIENT_ID: "test_client_id",
    OIDC_CLIENT_SECRET: "test_client_secret",
    OIDC_REDIRECT_URI: "https://example.com/callback",
    OIDC_AUTH_SECRET: "test_auth_secret_32chars_minimum!",
    ZAIM_CONSUMER_KEY: "zaim_consumer_key",
    ZAIM_CONSUMER_SECRET: "zaim_consumer_secret",
    ZAIM_KV: kvOverride ?? kv,
  };
};

// ── GET /api/zaim/accounts ──────────────────────────────────────────────────

describe("GET /api/zaim/accounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAccounts.mockResolvedValue({ data: MOCK_ACCOUNTS_RESPONSE });
  });

  test("OIDC未認証のとき401を返す", async () => {
    const res = await createTestClient(accountsRoutes, makeEnv(), {
      oidcAuth: null,
    }).api.zaim.accounts.$get({
      query: {},
    });
    expect(res.status).toBe(401);
  });

  test("Zaimトークン未連携のとき403を返す", async () => {
    const res = await createTestClient(accountsRoutes, makeEnv(), {
      oidcAuth: MOCK_USER,
    }).api.zaim.accounts.$get({
      query: {},
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/Zaim/);
  });

  test("KVキャッシュヒット時はZaim APIを呼ばずにキャッシュを返す", async () => {
    const { kv, mockGet } = createKVNamespaceMock();
    const cachedData = {
      fetchedAt: "2026-01-01T00:00:00.000Z",
      accounts: [{ id: 1, name: "現金" }],
    };
    mockGet.mockResolvedValueOnce(JSON.stringify(cachedData));

    const res = await createTestClient(accountsRoutes, makeEnv(kv), {
      oidcAuth: MOCK_USER,
      zaimClient: createZaimClientStub(),
      zaimUserId: "zaim_user_999",
    }).api.zaim.accounts.$get({ query: {} });
    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof cachedData;
    expect(body.fetchedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(mockGetAccounts).not.toHaveBeenCalled();
  });

  test("キャッシュミス時はZaim APIを呼んで口座一覧を返す", async () => {
    const { kv, mockGet } = createKVNamespaceMock();
    mockGet.mockResolvedValueOnce(null);

    const res = await createTestClient(accountsRoutes, makeEnv(kv), {
      oidcAuth: MOCK_USER,
      zaimClient: createZaimClientStub(),
      zaimUserId: "zaim_user_999",
    }).api.zaim.accounts.$get({ query: {} });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { fetchedAt: string; accounts: unknown[] };
    expect(body.accounts).toHaveLength(2);
    expect(mockGetAccounts).toHaveBeenCalledOnce();
  });

  test("口座取得後にKVへキャッシュを書き込む", async () => {
    const { kv, mockGet, mockPut } = createKVNamespaceMock();
    mockGet.mockResolvedValueOnce(null);

    await createTestClient(accountsRoutes, makeEnv(kv), {
      oidcAuth: MOCK_USER,
      zaimClient: createZaimClientStub(),
      zaimUserId: "zaim_user_999",
    }).api.zaim.accounts.$get({ query: {} });

    expect(mockPut).toHaveBeenCalledWith("zaim:cache:accounts:zaim_user_999", expect.any(String), {
      expirationTtl: 86400,
    });
  });

  test("no_cache=1のときKVキャッシュを無視してAPIを呼ぶ", async () => {
    const { kv, mockGet } = createKVNamespaceMock();
    const cachedData = { fetchedAt: "2026-01-01T00:00:00.000Z", accounts: [] };
    mockGet.mockResolvedValueOnce(JSON.stringify(cachedData));

    const res = await createTestClient(accountsRoutes, makeEnv(kv), {
      oidcAuth: MOCK_USER,
      zaimClient: createZaimClientStub(),
      zaimUserId: "zaim_user_999",
    }).api.zaim.accounts.$get({ query: { no_cache: "1" } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { accounts: unknown[] };
    expect(body.accounts).toHaveLength(2);
    expect(mockGetAccounts).toHaveBeenCalledOnce();
  });

  test("レスポンスにfetchedAt（ISO 8601）が含まれる", async () => {
    const { kv, mockGet } = createKVNamespaceMock();
    mockGet.mockResolvedValueOnce(null);

    const res = await createTestClient(accountsRoutes, makeEnv(kv), {
      oidcAuth: MOCK_USER,
      zaimClient: createZaimClientStub(),
      zaimUserId: "zaim_user_999",
    }).api.zaim.accounts.$get({ query: {} });
    const body = (await res.json()) as { fetchedAt: string };
    expect(() => new Date(body.fetchedAt)).not.toThrow();
    expect(body.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test("口座フィールドが正しくマッピングされる", async () => {
    const { kv, mockGet } = createKVNamespaceMock();
    mockGet.mockResolvedValueOnce(null);

    const res = await createTestClient(accountsRoutes, makeEnv(kv), {
      oidcAuth: MOCK_USER,
      zaimClient: createZaimClientStub(),
      zaimUserId: "zaim_user_999",
    }).api.zaim.accounts.$get({ query: {} });
    const body = (await res.json()) as {
      accounts: {
        id: number;
        name: string;
        localId: number;
        websiteId: number;
        parentAccountId: number;
      }[];
    };

    const acc = body.accounts[0];
    expect(acc.id).toBe(1);
    expect(acc.name).toBe("現金");
    expect(acc.localId).toBe(0);
    expect(acc.websiteId).toBe(0);
    expect(acc.parentAccountId).toBe(0);
  });
});
