/**
 * categories ルートのテスト
 *
 * GET /api/zaim/categories - カテゴリ＋サブカテゴリ一覧（KVキャッシュ付き）
 */

import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { testClient } from "hono/testing";
import { createKVNamespaceMock } from "../test-fixtures.ts";
import { categoriesRoutes } from "./categories.ts";
import type { Env } from "../env.ts";
import type { KVNamespace } from "@cloudflare/workers-types";
import type { OidcAuth } from "@hono/oidc-auth";

vi.mock("@hono/oidc-auth", () => ({
  getAuth: vi.fn(),
  revokeSession: vi.fn().mockResolvedValue(undefined),
}));

// vi.hoisted を使って @repo/zaim-api を import せずにモック関数を定義する
// (@repo/zaim-api は型生成が必要なため直接 import すると TypeScript エラーになる)
const { mockGetCategories, mockGetGenres } = vi.hoisted(() => ({
  mockGetCategories: vi.fn(),
  mockGetGenres: vi.fn(),
}));

vi.mock("@repo/zaim-api", () => ({
  categoryGetCategories: mockGetCategories,
  genreGetGenres: mockGetGenres,
}));

vi.mock("@repo/zaim-api/client", () => ({
  createClient: vi.fn(() => ({
    interceptors: { request: { use: vi.fn() } },
  })),
}));

vi.mock("@repo/zaim-api/oauth/interceptor", () => ({
  createZaimAuthInterceptor: vi.fn(() => () => {}),
}));

import { getAuth } from "@hono/oidc-auth";

const mockGetAuth = vi.mocked(getAuth);

const MOCK_USER = {
  sub: "auth0|user123",
  email: "user@example.com",
  rtk: "",
  rtkexp: 9999999999,
  ssnexp: 9999999999,
} as OidcAuth;

const STORED_TOKEN = JSON.stringify({
  oauthToken: "access_token",
  oauthTokenSecret: "access_secret",
  zaimUserId: "zaim_user_999",
});

const MOCK_CATEGORIES_RESPONSE = {
  categories: [
    { id: 101, name: "食費", mode: "payment" },
    { id: 102, name: "給与", mode: "income" },
  ],
};

const MOCK_GENRES_RESPONSE = {
  genres: [
    { id: 201, name: "外食", category_id: 101 },
    { id: 202, name: "食材", category_id: 101 },
    { id: 203, name: "月給", category_id: 102 },
  ],
};

function makeEnv(kvOverride?: KVNamespace): Env {
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
}

// ── GET /api/zaim/categories ──────────────────────────────────────────────────

describe("GET /api/zaim/categories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuth.mockResolvedValue(MOCK_USER);
    mockGetCategories.mockResolvedValue({ data: MOCK_CATEGORIES_RESPONSE });
    mockGetGenres.mockResolvedValue({ data: MOCK_GENRES_RESPONSE });
  });

  test("OIDC未認証のとき401を返す", async () => {
    mockGetAuth.mockResolvedValueOnce(null);
    const res = await testClient(categoriesRoutes, makeEnv()).api.zaim.categories.$get({
      query: {},
    });
    expect(res.status).toBe(401);
  });

  test("Zaimトークン未連携のとき403を返す", async () => {
    const res = await testClient(categoriesRoutes, makeEnv()).api.zaim.categories.$get({
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
      categories: [{ id: 101, name: "食費", mode: "payment", subCategories: [] }],
    };
    mockGet.mockResolvedValueOnce(STORED_TOKEN).mockResolvedValueOnce(JSON.stringify(cachedData));

    const res = await testClient(categoriesRoutes, makeEnv(kv)).api.zaim.categories.$get({
      query: {},
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof cachedData;
    expect(body.fetchedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(mockGetCategories).not.toHaveBeenCalled();
    expect(mockGetGenres).not.toHaveBeenCalled();
  });

  test("キャッシュミス時はZaim APIを呼んでカテゴリを返す", async () => {
    const { kv, mockGet } = createKVNamespaceMock();
    mockGet.mockResolvedValueOnce(STORED_TOKEN).mockResolvedValueOnce(null);

    const res = await testClient(categoriesRoutes, makeEnv(kv)).api.zaim.categories.$get({
      query: {},
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { fetchedAt: string; categories: unknown[] };
    expect(body.categories).toHaveLength(2);
    expect(mockGetCategories).toHaveBeenCalledOnce();
    expect(mockGetGenres).toHaveBeenCalledOnce();
  });

  test("カテゴリ取得後にKVへキャッシュを書き込む", async () => {
    const { kv, mockGet, mockPut } = createKVNamespaceMock();
    mockGet.mockResolvedValueOnce(STORED_TOKEN).mockResolvedValueOnce(null);

    await testClient(categoriesRoutes, makeEnv(kv)).api.zaim.categories.$get({ query: {} });

    expect(mockPut).toHaveBeenCalledWith(
      "zaim:cache:categories:zaim_user_999",
      expect.any(String),
      { expirationTtl: 86400 },
    );
  });

  test("ジャンルがカテゴリのsubCategoriesにネストされる", async () => {
    const { kv, mockGet } = createKVNamespaceMock();
    mockGet.mockResolvedValueOnce(STORED_TOKEN).mockResolvedValueOnce(null);

    const res = await testClient(categoriesRoutes, makeEnv(kv)).api.zaim.categories.$get({
      query: {},
    });
    const body = (await res.json()) as {
      categories: { id: number; subCategories: { id: number; name: string }[] }[];
    };

    const shokuhi = body.categories.find((c) => c.id === 101);
    expect(shokuhi?.subCategories).toHaveLength(2);
    expect(shokuhi?.subCategories.map((s) => s.id)).toEqual([201, 202]);
  });

  test("no_cache=1のときKVキャッシュを無視してAPIを呼ぶ", async () => {
    const { kv, mockGet } = createKVNamespaceMock();
    const cachedData = { fetchedAt: "2026-01-01T00:00:00.000Z", categories: [] };
    mockGet.mockResolvedValueOnce(STORED_TOKEN).mockResolvedValueOnce(JSON.stringify(cachedData));

    const res = await testClient(categoriesRoutes, makeEnv(kv)).api.zaim.categories.$get({
      query: { no_cache: "1" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { categories: unknown[] };
    expect(body.categories).toHaveLength(2);
    expect(mockGetCategories).toHaveBeenCalledOnce();
  });

  test("レスポンスにfetchedAt（ISO 8601）が含まれる", async () => {
    const { kv, mockGet } = createKVNamespaceMock();
    mockGet.mockResolvedValueOnce(STORED_TOKEN).mockResolvedValueOnce(null);

    const res = await testClient(categoriesRoutes, makeEnv(kv)).api.zaim.categories.$get({
      query: {},
    });
    const body = (await res.json()) as { fetchedAt: string };
    expect(() => new Date(body.fetchedAt)).not.toThrow();
    expect(body.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
