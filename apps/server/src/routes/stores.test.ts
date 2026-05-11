/**
 * stores ルートのテスト
 *
 * GET /api/zaim/stores - 店舗一覧（KVキャッシュ付き）
 *
 * KV キー:
 *   zaim:cache:stores:{zaim_user_id}           - 店舗リストキャッシュ
 *   zaim:cache:money:{zaim_user_id}:{yyyy-mm}  - 月別支払いアイテムキャッシュ
 */

import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { createKVNamespaceMock, createTestClient, createZaimClientStub } from "../test-fixtures.ts";
import { storesRoutes } from "./stores.ts";
import type { Env } from "../env.ts";
import type { KVNamespace } from "@cloudflare/workers-types";
import type { OidcAuth } from "@hono/oidc-auth";

const { mockMoneyGetMoney } = vi.hoisted(() => ({
  mockMoneyGetMoney: vi.fn(),
}));

vi.mock("@repo/zaim-api", () => ({
  moneyGetMoney: mockMoneyGetMoney,
}));

const MOCK_USER = {
  sub: "auth0|user123",
  email: "user@example.com",
  rtk: "",
  rtkexp: 9999999999,
  ssnexp: 9999999999,
} as OidcAuth;

const MOCK_MONEY_RESPONSE = {
  money: [
    {
      id: 1,
      mode: "payment",
      user_id: 999,
      date: "2026-04-10",
      category_id: 101,
      genre_id: 201,
      to_account_id: 0,
      from_account_id: 1,
      amount: 1500,
      comment: "",
      active: 1,
      name: "",
      receipt_id: 0,
      place: "スーパーA",
      place_uid: "uid_super_a",
      created: "2026-04-10T10:00:00Z",
      currency_code: "JPY",
    },
    {
      id: 2,
      mode: "payment",
      user_id: 999,
      date: "2026-04-15",
      category_id: 101,
      genre_id: 201,
      to_account_id: 0,
      from_account_id: 1,
      amount: 2000,
      comment: "",
      active: 1,
      name: "",
      receipt_id: 0,
      place: "スーパーA",
      place_uid: "uid_super_a",
      created: "2026-04-15T10:00:00Z",
      currency_code: "JPY",
    },
    {
      id: 3,
      mode: "payment",
      user_id: 999,
      date: "2026-05-01",
      category_id: 102,
      genre_id: 202,
      to_account_id: 0,
      from_account_id: 1,
      amount: 500,
      comment: "",
      active: 1,
      name: "",
      receipt_id: 0,
      place: "カフェB",
      place_uid: "uid_cafe_b",
      created: "2026-05-01T10:00:00Z",
      currency_code: "JPY",
    },
    {
      id: 4,
      mode: "payment",
      user_id: 999,
      date: "2026-03-20",
      category_id: 101,
      genre_id: 201,
      to_account_id: 0,
      from_account_id: 1,
      amount: 800,
      comment: "",
      active: 1,
      name: "",
      receipt_id: 0,
      place: "",
      place_uid: "",
      created: "2026-03-20T10:00:00Z",
      currency_code: "JPY",
    },
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

// ── GET /api/zaim/stores ──────────────────────────────────────────────────────

describe("GET /api/zaim/stores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMoneyGetMoney.mockResolvedValue({ data: MOCK_MONEY_RESPONSE });
  });

  test("OIDC未認証のとき401を返す", async () => {
    const res = await createTestClient(storesRoutes, makeEnv(), {
      oidcAuth: null,
    }).api.zaim.stores.$get({
      query: {},
    });
    expect(res.status).toBe(401);
  });

  test("Zaimトークン未連携のとき403を返す", async () => {
    const res = await createTestClient(storesRoutes, makeEnv(), {
      oidcAuth: MOCK_USER,
    }).api.zaim.stores.$get({
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
      stores: [{ place: "スーパーA", placeUid: "uid_super_a", latestDate: "2026-04-15", count: 2 }],
    };
    mockGet.mockResolvedValueOnce(JSON.stringify(cachedData));

    const res = await createTestClient(storesRoutes, makeEnv(kv), {
      oidcAuth: MOCK_USER,
      zaimClient: createZaimClientStub(),
      zaimUserId: "zaim_user_999",
    }).api.zaim.stores.$get({ query: {} });
    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof cachedData;
    expect(body.fetchedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(mockMoneyGetMoney).not.toHaveBeenCalled();
  });

  test("キャッシュミス時はZaim APIを呼んで店舗一覧を返す", async () => {
    const { kv, mockGet } = createKVNamespaceMock();
    mockGet.mockResolvedValueOnce(null);

    const res = await createTestClient(storesRoutes, makeEnv(kv), {
      oidcAuth: MOCK_USER,
      zaimClient: createZaimClientStub(),
      zaimUserId: "zaim_user_999",
    }).api.zaim.stores.$get({ query: {} });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { fetchedAt: string; stores: unknown[] };
    expect(body.stores).toHaveLength(2);
    expect(mockMoneyGetMoney).toHaveBeenCalledOnce();
  });

  test("placeが空のアイテムは店舗リストに含まれない", async () => {
    const { kv, mockGet } = createKVNamespaceMock();
    mockGet.mockResolvedValueOnce(null);

    const res = await createTestClient(storesRoutes, makeEnv(kv), {
      oidcAuth: MOCK_USER,
      zaimClient: createZaimClientStub(),
      zaimUserId: "zaim_user_999",
    }).api.zaim.stores.$get({ query: {} });
    const body = (await res.json()) as {
      stores: { place: string }[];
    };
    expect(body.stores.every((s) => s.place !== "")).toBe(true);
  });

  test("同じplace_uidの支払いが集約されてcountとlatestDateが正しい", async () => {
    const { kv, mockGet } = createKVNamespaceMock();
    mockGet.mockResolvedValueOnce(null);

    const res = await createTestClient(storesRoutes, makeEnv(kv), {
      oidcAuth: MOCK_USER,
      zaimClient: createZaimClientStub(),
      zaimUserId: "zaim_user_999",
    }).api.zaim.stores.$get({ query: {} });
    const body = (await res.json()) as {
      stores: { place: string; placeUid: string; latestDate: string; count: number }[];
    };

    const superA = body.stores.find((s) => s.placeUid === "uid_super_a");
    expect(superA).toBeDefined();
    expect(superA?.count).toBe(2);
    expect(superA?.latestDate).toBe("2026-04-15");
  });

  test("店舗一覧がlatestDate降順で返る", async () => {
    const { kv, mockGet } = createKVNamespaceMock();
    mockGet.mockResolvedValueOnce(null);

    const res = await createTestClient(storesRoutes, makeEnv(kv), {
      oidcAuth: MOCK_USER,
      zaimClient: createZaimClientStub(),
      zaimUserId: "zaim_user_999",
    }).api.zaim.stores.$get({ query: {} });
    const body = (await res.json()) as {
      stores: { latestDate: string }[];
    };
    const dates = body.stores.map((s) => s.latestDate);
    const sorted = [...dates].sort((a, b) => b.localeCompare(a));
    expect(dates).toEqual(sorted);
  });

  test("取得後に店舗リストをKVにキャッシュする", async () => {
    const { kv, mockGet, mockPut } = createKVNamespaceMock();
    mockGet.mockResolvedValueOnce(null);

    await createTestClient(storesRoutes, makeEnv(kv), {
      oidcAuth: MOCK_USER,
      zaimClient: createZaimClientStub(),
      zaimUserId: "zaim_user_999",
    }).api.zaim.stores.$get({ query: {} });

    expect(mockPut).toHaveBeenCalledWith("zaim:cache:stores:zaim_user_999", expect.any(String), {
      expirationTtl: 3600,
    });
  });

  test("取得後に月別moneyキャッシュをKVに書き込む", async () => {
    const { kv, mockGet, mockPut } = createKVNamespaceMock();
    mockGet.mockResolvedValueOnce(null);

    await createTestClient(storesRoutes, makeEnv(kv), {
      oidcAuth: MOCK_USER,
      zaimClient: createZaimClientStub(),
      zaimUserId: "zaim_user_999",
    }).api.zaim.stores.$get({ query: {} });

    const monthlyPuts = mockPut.mock.calls.filter(([key]) =>
      (key as string).startsWith("zaim:cache:money:"),
    );
    expect(monthlyPuts.length).toBeGreaterThan(0);
  });

  test("no_cache=1のときKVキャッシュを無視してAPIを呼ぶ", async () => {
    const { kv, mockGet } = createKVNamespaceMock();
    const cachedData = { fetchedAt: "2026-01-01T00:00:00.000Z", stores: [] };
    mockGet.mockResolvedValueOnce(JSON.stringify(cachedData));

    const res = await createTestClient(storesRoutes, makeEnv(kv), {
      oidcAuth: MOCK_USER,
      zaimClient: createZaimClientStub(),
      zaimUserId: "zaim_user_999",
    }).api.zaim.stores.$get({ query: { no_cache: "1" } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { stores: unknown[] };
    expect(body.stores).toHaveLength(2);
    expect(mockMoneyGetMoney).toHaveBeenCalledOnce();
  });

  test("レスポンスにfetchedAt（ISO 8601）が含まれる", async () => {
    const { kv, mockGet } = createKVNamespaceMock();
    mockGet.mockResolvedValueOnce(null);

    const res = await createTestClient(storesRoutes, makeEnv(kv), {
      oidcAuth: MOCK_USER,
      zaimClient: createZaimClientStub(),
      zaimUserId: "zaim_user_999",
    }).api.zaim.stores.$get({ query: {} });
    const body = (await res.json()) as { fetchedAt: string };
    expect(() => new Date(body.fetchedAt)).not.toThrow();
    expect(body.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
