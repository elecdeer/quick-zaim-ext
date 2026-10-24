/**
 * payment ルートのテスト
 *
 * POST /api/zaim/payment          - 支払い登録
 * GET  /api/zaim/payment/duplicate - 重複チェック
 * POST /api/zaim/payment/duplicate/bulk - 明細の一括登録済み判定
 *
 * Zaim API のモックは vi.mock ではなく MSW を使用する。
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vite-plus/test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { moneyGetMoneyMockHandler, paymentOperationsCreateMockHandler } from "@repo/zaim-api";
import { createClient } from "@repo/zaim-api/client";
import { createKVNamespaceMock, createTestClient, createTestEnv } from "../../test-fixtures.ts";
import { paymentRoutes } from "./index.ts";
import type { Env } from "../../env.ts";
import type { KVNamespace } from "@cloudflare/workers-types";
import type { AccessUser } from "../../access.ts";
import type { MonthlyMoneyCache } from "../stores/schema.ts";

// ── MSW セットアップ ────────────────────────────────────────────────────────

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ── テスト共通データ ────────────────────────────────────────────────────────

const MOCK_USER: AccessUser = { id: "user@example.com", email: "user@example.com" };

const MOCK_PAYMENT_BODY = {
  money: {
    id: 999,
    modified: "2026-05-20T10:00:00Z",
    place_uid: "uid_super_a",
  },
  user: { repeat_count: 10, day_count: 20, input_count: 100 },
  requested: 1,
};

const MOCK_MONEY_ITEMS = [
  {
    id: 1,
    mode: "payment" as const,
    user_id: 999,
    date: "2026-05-19",
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
    created: "2026-05-19T10:00:00Z",
    currency_code: "JPY",
  },
  {
    id: 2,
    mode: "payment" as const,
    user_id: 999,
    date: "2026-05-18",
    category_id: 102,
    genre_id: 202,
    to_account_id: 0,
    from_account_id: 1,
    amount: 800,
    comment: "",
    active: 1,
    name: "",
    receipt_id: 0,
    place: "カフェB",
    place_uid: "uid_cafe_b",
    created: "2026-05-18T10:00:00Z",
    currency_code: "JPY",
  },
];

const makeEnv = (kvOverride?: KVNamespace): Env =>
  kvOverride ? createTestEnv({ ZAIM_KV: kvOverride }) : createTestEnv();

const createZaimRealClient = () => createClient({ baseUrl: "https://api.zaim.net" });

// ── POST /api/zaim/payment ───────────────────────────────────────────────────

describe("POST /api/zaim/payment", () => {
  beforeEach(() => {
    server.use(paymentOperationsCreateMockHandler(() => HttpResponse.json(MOCK_PAYMENT_BODY)));
  });

  test("Access未認証のとき401を返す", async () => {
    const res = await createTestClient(paymentRoutes, makeEnv(), {
      user: null,
    }).api.zaim.payment.$post({
      json: { category_id: 101, genre_id: 201, amount: 1500, date: "2026-05-20" },
    });
    expect(res.status).toBe(401);
  });

  test("Zaimトークン未連携のとき403を返す", async () => {
    const res = await createTestClient(paymentRoutes, makeEnv(), {
      user: MOCK_USER,
    }).api.zaim.payment.$post({
      json: { category_id: 101, genre_id: 201, amount: 1500, date: "2026-05-20" },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/Zaim/);
  });

  test("リクエストボディが不正のとき400を返す", async () => {
    const res = await createTestClient(paymentRoutes, makeEnv(), {
      user: MOCK_USER,
      zaimClient: createZaimRealClient(),
      zaimUserId: "zaim_user_999",
    }).api.zaim.payment.$post({
      // amount が欠如
      json: { category_id: 101, genre_id: 201 } as any,
    });
    expect(res.status).toBe(400);
  });

  test("正常系: 支払いが登録され201とidを返す", async () => {
    const res = await createTestClient(paymentRoutes, makeEnv(), {
      user: MOCK_USER,
      zaimClient: createZaimRealClient(),
      zaimUserId: "zaim_user_999",
    }).api.zaim.payment.$post({
      json: { category_id: 101, genre_id: 201, amount: 1500, date: "2026-05-20" },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: number; modified: string; placeUid?: string };
    expect(body.id).toBe(999);
    expect(body.modified).toBe("2026-05-20T10:00:00Z");
    expect(body.placeUid).toBe("uid_super_a");
  });

  test("Zaim APIが失敗したとき502と上流のステータス・メッセージを返す", async () => {
    server.use(
      paymentOperationsCreateMockHandler(() =>
        HttpResponse.json(
          { error: true, message: "oauth_problem=token_rejected" },
          { status: 401 },
        ),
      ),
    );

    const res = await createTestClient(paymentRoutes, makeEnv(), {
      user: MOCK_USER,
      zaimClient: createZaimRealClient(),
      zaimUserId: "zaim_user_999",
    }).api.zaim.payment.$post({
      json: { category_id: 101, genre_id: 201, amount: 1500, date: "2026-05-20" },
    });

    expect(res.status).toBe(502);
    const body = (await res.json()) as {
      error: string;
      upstreamStatus?: number;
      upstreamMessage?: string;
    };
    expect(body.upstreamStatus).toBe(401);
    expect(body.upstreamMessage).toContain("401");
    expect(body.upstreamMessage).toContain("oauth_problem=token_rejected");
  });

  test("登録後に月別moneyキャッシュを削除する", async () => {
    const { kv, mockDelete } = createKVNamespaceMock();

    await createTestClient(paymentRoutes, makeEnv(kv), {
      user: MOCK_USER,
      zaimClient: createZaimRealClient(),
      zaimUserId: "zaim_user_999",
    }).api.zaim.payment.$post({
      json: { category_id: 101, genre_id: 201, amount: 1500, date: "2026-05-20" },
    });

    expect(mockDelete).toHaveBeenCalledWith("zaim:cache:money:zaim_user_999:2026-05");
  });

  test("登録後にstoresキャッシュを削除する", async () => {
    const { kv, mockDelete } = createKVNamespaceMock();

    await createTestClient(paymentRoutes, makeEnv(kv), {
      user: MOCK_USER,
      zaimClient: createZaimRealClient(),
      zaimUserId: "zaim_user_999",
    }).api.zaim.payment.$post({
      json: { category_id: 101, genre_id: 201, amount: 1500, date: "2026-05-20" },
    });

    expect(mockDelete).toHaveBeenCalledWith("zaim:cache:stores:zaim_user_999");
  });

  test("店舗は place_uid でZaim APIに渡す", async () => {
    let requestedUrl: URL | undefined;
    // 生成されたモックハンドラーの resolver 型には request が含まれないため msw の http を直接使う
    server.use(
      http.post("*/v2/home/money/payment", ({ request }) => {
        requestedUrl = new URL(request.url);
        return HttpResponse.json(MOCK_PAYMENT_BODY);
      }),
    );

    await createTestClient(paymentRoutes, makeEnv(), {
      user: MOCK_USER,
      zaimClient: createZaimRealClient(),
      zaimUserId: "zaim_user_999",
    }).api.zaim.payment.$post({
      json: {
        category_id: 101,
        genre_id: 201,
        amount: 1500,
        date: "2026-05-20",
        place_uid: "uid_super_a",
      },
    });

    expect(requestedUrl?.searchParams.get("place_uid")).toBe("uid_super_a");
  });
});

// ── GET /api/zaim/payment/duplicate ─────────────────────────────────────────

describe("GET /api/zaim/payment/duplicate", () => {
  beforeEach(() => {
    server.use(
      moneyGetMoneyMockHandler(() => HttpResponse.json({ money: MOCK_MONEY_ITEMS, requested: 1 })),
    );
  });

  test("Access未認証のとき401を返す", async () => {
    const res = await createTestClient(paymentRoutes, makeEnv(), {
      user: null,
    }).api.zaim.payment.duplicate.$get({
      query: { date: "2026-05-19", amount: "1500", genre_id: "201" },
    });
    expect(res.status).toBe(401);
  });

  test("Zaimトークン未連携のとき403を返す", async () => {
    const res = await createTestClient(paymentRoutes, makeEnv(), {
      user: MOCK_USER,
    }).api.zaim.payment.duplicate.$get({
      query: { date: "2026-05-19", amount: "1500", genre_id: "201" },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/Zaim/);
  });

  test("クエリパラメータが不正のとき400を返す", async () => {
    const res = await createTestClient(paymentRoutes, makeEnv(), {
      user: MOCK_USER,
      zaimClient: createZaimRealClient(),
      zaimUserId: "zaim_user_999",
    }).api.zaim.payment.duplicate.$get({
      query: { date: "invalid-date", amount: "1500", genre_id: "201" },
    });
    expect(res.status).toBe(400);
  });

  test("KVキャッシュヒット時はZaim APIを呼ばず重複チェックする", async () => {
    const { kv, mockGet } = createKVNamespaceMock();
    const cachedItems: MonthlyMoneyCache = {
      fetchedAt: "2026-05-01T00:00:00.000Z",
      items: [
        {
          id: 1,
          date: "2026-05-19",
          amount: 1500,
          place: "スーパーA",
          placeUid: "uid_super_a",
          mode: "payment",
          categoryId: 101,
          genreId: 201,
        },
      ],
    };
    mockGet.mockResolvedValueOnce(JSON.stringify(cachedItems));

    server.resetHandlers();
    const res = await createTestClient(paymentRoutes, makeEnv(kv), {
      user: MOCK_USER,
      zaimClient: createZaimRealClient(),
      zaimUserId: "zaim_user_999",
    }).api.zaim.payment.duplicate.$get({
      query: { date: "2026-05-19", amount: "1500", genre_id: "201" },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { duplicates: unknown[] };
    expect(body.duplicates).toHaveLength(1);
  });

  test("キャッシュミス時はZaim APIを呼んで重複チェックする", async () => {
    const { kv, mockGet } = createKVNamespaceMock();
    mockGet.mockResolvedValueOnce(null);

    const res = await createTestClient(paymentRoutes, makeEnv(kv), {
      user: MOCK_USER,
      zaimClient: createZaimRealClient(),
      zaimUserId: "zaim_user_999",
    }).api.zaim.payment.duplicate.$get({
      query: { date: "2026-05-19", amount: "1500", genre_id: "201" },
    });

    expect(res.status).toBe(200);
  });

  test("同じgenre_id・amount・日付のアイテムが重複として返る", async () => {
    const { kv, mockGet } = createKVNamespaceMock();
    mockGet.mockResolvedValueOnce(null);

    const res = await createTestClient(paymentRoutes, makeEnv(kv), {
      user: MOCK_USER,
      zaimClient: createZaimRealClient(),
      zaimUserId: "zaim_user_999",
    }).api.zaim.payment.duplicate.$get({
      query: { date: "2026-05-19", amount: "1500", genre_id: "201" },
    });

    const body = (await res.json()) as {
      duplicates: { id: number; genreId: number; amount: number }[];
    };
    expect(body.duplicates).toHaveLength(1);
    expect(body.duplicates[0].id).toBe(1);
    expect(body.duplicates[0].genreId).toBe(201);
    expect(body.duplicates[0].amount).toBe(1500);
  });

  test("genre_idが異なるアイテムは重複に含まれない", async () => {
    const { kv, mockGet } = createKVNamespaceMock();
    mockGet.mockResolvedValueOnce(null);

    const res = await createTestClient(paymentRoutes, makeEnv(kv), {
      user: MOCK_USER,
      zaimClient: createZaimRealClient(),
      zaimUserId: "zaim_user_999",
    }).api.zaim.payment.duplicate.$get({
      query: { date: "2026-05-18", amount: "1500", genre_id: "202" },
    });

    const body = (await res.json()) as { duplicates: unknown[] };
    expect(body.duplicates).toHaveLength(0);
  });

  test("amountが異なるアイテムは重複に含まれない", async () => {
    const { kv, mockGet } = createKVNamespaceMock();
    mockGet.mockResolvedValueOnce(null);

    const res = await createTestClient(paymentRoutes, makeEnv(kv), {
      user: MOCK_USER,
      zaimClient: createZaimRealClient(),
      zaimUserId: "zaim_user_999",
    }).api.zaim.payment.duplicate.$get({
      query: { date: "2026-05-19", amount: "9999", genre_id: "201" },
    });

    const body = (await res.json()) as { duplicates: unknown[] };
    expect(body.duplicates).toHaveLength(0);
  });

  test("日付が±1日以内のアイテムが重複として返る", async () => {
    const { kv, mockGet } = createKVNamespaceMock();
    const cachedItems: MonthlyMoneyCache = {
      fetchedAt: "2026-05-01T00:00:00.000Z",
      items: [
        {
          id: 1,
          date: "2026-05-18",
          amount: 1500,
          place: "スーパーA",
          placeUid: "uid_super_a",
          mode: "payment",
          categoryId: 101,
          genreId: 201,
        },
      ],
    };
    mockGet.mockResolvedValueOnce(JSON.stringify(cachedItems));

    const res = await createTestClient(paymentRoutes, makeEnv(kv), {
      user: MOCK_USER,
      zaimClient: createZaimRealClient(),
      zaimUserId: "zaim_user_999",
    }).api.zaim.payment.duplicate.$get({
      query: { date: "2026-05-19", amount: "1500", genre_id: "201" },
    });

    const body = (await res.json()) as { duplicates: { id: number }[] };
    expect(body.duplicates).toHaveLength(1);
    expect(body.duplicates[0].id).toBe(1);
  });

  test("重複なしのとき空配列を返す", async () => {
    const { kv, mockGet } = createKVNamespaceMock();
    mockGet.mockResolvedValueOnce(null);

    const res = await createTestClient(paymentRoutes, makeEnv(kv), {
      user: MOCK_USER,
      zaimClient: createZaimRealClient(),
      zaimUserId: "zaim_user_999",
    }).api.zaim.payment.duplicate.$get({
      query: { date: "2026-05-19", amount: "99999", genre_id: "999" },
    });

    const body = (await res.json()) as { duplicates: unknown[] };
    expect(body.duplicates).toHaveLength(0);
  });

  test("キャッシュミス後に月別moneyキャッシュを書き込む", async () => {
    const { kv, mockGet, mockPut } = createKVNamespaceMock();
    mockGet.mockResolvedValueOnce(null);

    await createTestClient(paymentRoutes, makeEnv(kv), {
      user: MOCK_USER,
      zaimClient: createZaimRealClient(),
      zaimUserId: "zaim_user_999",
    }).api.zaim.payment.duplicate.$get({
      query: { date: "2026-05-19", amount: "1500", genre_id: "201" },
    });

    expect(mockPut).toHaveBeenCalledWith(
      "zaim:cache:money:zaim_user_999:2026-05",
      expect.any(String),
      { expirationTtl: 3600 },
    );
  });
});

// ── POST /api/zaim/payment/duplicate/bulk ───────────────────────────────────

describe("POST /api/zaim/payment/duplicate/bulk", () => {
  beforeEach(() => {
    server.use(
      moneyGetMoneyMockHandler(() => HttpResponse.json({ money: MOCK_MONEY_ITEMS, requested: 1 })),
    );
  });

  test("Access未認証のとき401を返す", async () => {
    const res = await createTestClient(paymentRoutes, makeEnv(), {
      user: null,
    }).api.zaim.payment.duplicate.bulk.$post({
      json: { entries: [{ date: "2026-05-19", amount: 1500 }] },
    });
    expect(res.status).toBe(401);
  });

  test("Zaimトークン未連携のとき403を返す", async () => {
    const res = await createTestClient(paymentRoutes, makeEnv(), {
      user: MOCK_USER,
    }).api.zaim.payment.duplicate.bulk.$post({
      json: { entries: [{ date: "2026-05-19", amount: 1500 }] },
    });
    expect(res.status).toBe(403);
  });

  test("リクエストボディが不正のとき400を返す", async () => {
    const res = await createTestClient(paymentRoutes, makeEnv(), {
      user: MOCK_USER,
      zaimClient: createZaimRealClient(),
      zaimUserId: "zaim_user_999",
    }).api.zaim.payment.duplicate.bulk.$post({
      json: { entries: [{ date: "2026/05/19", amount: 1500 }] },
    });
    expect(res.status).toBe(400);
  });

  test("各行について登録済みの支払いを同じ順序で返す", async () => {
    const { kv, mockGet } = createKVNamespaceMock();
    mockGet.mockResolvedValue(null);

    const res = await createTestClient(paymentRoutes, makeEnv(kv), {
      user: MOCK_USER,
      zaimClient: createZaimRealClient(),
      zaimUserId: "zaim_user_999",
    }).api.zaim.payment.duplicate.bulk.$post({
      json: {
        entries: [
          // 既存 id=2（2026-05-18, 800円）と 2 日ずれ・カテゴリ不問で一致
          { date: "2026-05-20", amount: 800 },
          { date: "2026-05-19", amount: 9999 },
          // 既存 id=1（2026-05-19, 1500円）と一致
          { date: "2026-05-19", amount: 1500 },
        ],
      },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { results: { match: { id: number } | null }[] };
    expect(body.results.map((r) => r.match?.id ?? null)).toEqual([2, null, 1]);
  });

  test("日付±2日が含まれる月をすべて読み込む", async () => {
    const { kv, mockGet } = createKVNamespaceMock();
    mockGet.mockResolvedValue(null);

    await createTestClient(paymentRoutes, makeEnv(kv), {
      user: MOCK_USER,
      zaimClient: createZaimRealClient(),
      zaimUserId: "zaim_user_999",
    }).api.zaim.payment.duplicate.bulk.$post({
      json: { entries: [{ date: "2026-05-31", amount: 1500 }] },
    });

    expect(mockGet).toHaveBeenCalledWith("zaim:cache:money:zaim_user_999:2026-05");
    expect(mockGet).toHaveBeenCalledWith("zaim:cache:money:zaim_user_999:2026-06");
  });
});
