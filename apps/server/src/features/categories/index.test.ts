/**
 * categories ルートのテスト
 *
 * GET /api/zaim/categories - カテゴリ＋サブカテゴリ一覧（KVキャッシュ付き）
 */

import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  createKVNamespaceMock,
  createTestClient,
  createTestEnv,
  createZaimClientStub,
} from "../../test-fixtures.ts";
import { categoriesRoutes } from "./index.ts";
import type { Env } from "../../env.ts";
import type { KVNamespace } from "@cloudflare/workers-types";
import type { OidcAuth } from "@hono/oidc-auth";

const { mockGetCategories, mockGetGenres } = vi.hoisted(() => ({
  mockGetCategories: vi.fn(),
  mockGetGenres: vi.fn(),
}));

vi.mock("@repo/zaim-api", () => ({
  categoryGetCategories: mockGetCategories,
  genreGetGenres: mockGetGenres,
}));

const MOCK_USER = {
  sub: "auth0|user123",
  email: "user@example.com",
  rtk: "",
  rtkexp: 9999999999,
  ssnexp: 9999999999,
} as OidcAuth;

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

const makeEnv = (kvOverride?: KVNamespace): Env =>
  kvOverride ? createTestEnv({ ZAIM_KV: kvOverride }) : createTestEnv();

// ── GET /api/zaim/categories ──────────────────────────────────────────────────

describe("GET /api/zaim/categories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCategories.mockResolvedValue({ data: MOCK_CATEGORIES_RESPONSE });
    mockGetGenres.mockResolvedValue({ data: MOCK_GENRES_RESPONSE });
  });

  test("OIDC未認証のとき401を返す", async () => {
    const res = await createTestClient(categoriesRoutes, makeEnv(), {
      oidcAuth: null,
    }).api.zaim.categories.$get({
      query: {},
    });
    expect(res.status).toBe(401);
  });

  test("Zaimトークン未連携のとき403を返す", async () => {
    const res = await createTestClient(categoriesRoutes, makeEnv(), {
      oidcAuth: MOCK_USER,
    }).api.zaim.categories.$get({
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
    mockGet.mockResolvedValueOnce(JSON.stringify(cachedData));

    const res = await createTestClient(categoriesRoutes, makeEnv(kv), {
      oidcAuth: MOCK_USER,
      zaimClient: createZaimClientStub(),
      zaimUserId: "zaim_user_999",
    }).api.zaim.categories.$get({ query: {} });
    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof cachedData;
    expect(body.fetchedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(mockGetCategories).not.toHaveBeenCalled();
    expect(mockGetGenres).not.toHaveBeenCalled();
  });

  test("キャッシュミス時はZaim APIを呼んでカテゴリを返す", async () => {
    const { kv, mockGet } = createKVNamespaceMock();
    mockGet.mockResolvedValueOnce(null);

    const res = await createTestClient(categoriesRoutes, makeEnv(kv), {
      oidcAuth: MOCK_USER,
      zaimClient: createZaimClientStub(),
      zaimUserId: "zaim_user_999",
    }).api.zaim.categories.$get({ query: {} });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { fetchedAt: string; categories: unknown[] };
    expect(body.categories).toHaveLength(2);
    expect(mockGetCategories).toHaveBeenCalledOnce();
    expect(mockGetGenres).toHaveBeenCalledOnce();
  });

  test("カテゴリ取得後にKVへキャッシュを書き込む", async () => {
    const { kv, mockGet, mockPut } = createKVNamespaceMock();
    mockGet.mockResolvedValueOnce(null);

    await createTestClient(categoriesRoutes, makeEnv(kv), {
      oidcAuth: MOCK_USER,
      zaimClient: createZaimClientStub(),
      zaimUserId: "zaim_user_999",
    }).api.zaim.categories.$get({ query: {} });

    expect(mockPut).toHaveBeenCalledWith(
      "zaim:cache:categories:zaim_user_999",
      expect.any(String),
      { expirationTtl: 86400 },
    );
  });

  test("ジャンルがカテゴリのsubCategoriesにネストされる", async () => {
    const { kv, mockGet } = createKVNamespaceMock();
    mockGet.mockResolvedValueOnce(null);

    const res = await createTestClient(categoriesRoutes, makeEnv(kv), {
      oidcAuth: MOCK_USER,
      zaimClient: createZaimClientStub(),
      zaimUserId: "zaim_user_999",
    }).api.zaim.categories.$get({ query: {} });
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
    mockGet.mockResolvedValueOnce(JSON.stringify(cachedData));

    const res = await createTestClient(categoriesRoutes, makeEnv(kv), {
      oidcAuth: MOCK_USER,
      zaimClient: createZaimClientStub(),
      zaimUserId: "zaim_user_999",
    }).api.zaim.categories.$get({ query: { no_cache: "1" } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { categories: unknown[] };
    expect(body.categories).toHaveLength(2);
    expect(mockGetCategories).toHaveBeenCalledOnce();
  });

  test("レスポンスにfetchedAt（ISO 8601）が含まれる", async () => {
    const { kv, mockGet } = createKVNamespaceMock();
    mockGet.mockResolvedValueOnce(null);

    const res = await createTestClient(categoriesRoutes, makeEnv(kv), {
      oidcAuth: MOCK_USER,
      zaimClient: createZaimClientStub(),
      zaimUserId: "zaim_user_999",
    }).api.zaim.categories.$get({ query: {} });
    const body = (await res.json()) as { fetchedAt: string };
    expect(() => new Date(body.fetchedAt)).not.toThrow();
    expect(body.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
