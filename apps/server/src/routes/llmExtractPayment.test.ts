/**
 * llmExtractPayment ルートのテスト
 *
 * POST /api/llm/extract-payment - ページ内容から支払い情報を抽出する
 *
 * AI SDK の `MockLanguageModelV3` を `c.var.llmModel` に注入することで
 * 実 API を叩かずに振る舞いをテストする。
 */

import { describe, expect, test } from "vitest";
import type { OidcAuth } from "@hono/oidc-auth";
import type { KVNamespace } from "@cloudflare/workers-types";
import { MockLanguageModelV3 } from "ai/test";
import type { Env } from "../env.ts";
import { createTestClient, createTestEnv } from "../test-fixtures.ts";
import { llmExtractPaymentRoutes } from "./llmExtractPayment.ts";
import type { ExtractedPayment, ExtractPaymentBody } from "../llm/extractPayment.ts";

const MOCK_USER = {
  sub: "auth0|user123",
  email: "user@example.com",
  rtk: "",
  rtkexp: 9999999999,
  ssnexp: 9999999999,
} as OidcAuth;

const makeEnv = (kvOverride?: KVNamespace): Env =>
  kvOverride ? createTestEnv({ ZAIM_KV: kvOverride }) : createTestEnv();

const makeBody = (): ExtractPaymentBody => ({
  pageContent: {
    url: "https://example.com/order/123",
    title: "ご注文確認",
    ariaSnapshot: "heading: ご注文確認\nparagraph: 合計 1,980円\nparagraph: 注文日 2026-06-01",
    collectedAt: "2026-06-01T12:00:00Z",
  },
  categories: [
    {
      id: 101,
      name: "食費",
      mode: "payment",
      subCategories: [{ id: 201, name: "食料品" }],
    },
  ],
  accounts: [{ id: 1, name: "現金" }],
  recentStores: [
    { place: "スーパーA", placeUid: "uid_super_a", latestDate: "2026-05-30", count: 5 },
  ],
});

/**
 * generateObject が期待する形でテキストを返すモックモデルを生成する。
 */
const mockModelReturning = (object: ExtractedPayment): MockLanguageModelV3 =>
  new MockLanguageModelV3({
    doGenerate: async () => ({
      content: [{ type: "text", text: JSON.stringify(object) }],
      finishReason: { unified: "stop", raw: "stop" },
      usage: {
        inputTokens: { total: 100, noCache: 100, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 50, text: 50, reasoning: undefined },
      },
      warnings: [],
    }),
  });

const mockModelThrowing = (): MockLanguageModelV3 =>
  new MockLanguageModelV3({
    doGenerate: async () => {
      throw new Error("LLM API timeout");
    },
  });

describe("POST /api/llm/extract-payment", () => {
  test("OIDC未認証のとき401を返す", async () => {
    const res = await createTestClient(llmExtractPaymentRoutes, makeEnv(), {
      oidcAuth: null,
    }).api.llm["extract-payment"].$post({ json: makeBody() });
    expect(res.status).toBe(401);
  });

  test("リクエストボディが不正のとき400を返す", async () => {
    const res = await createTestClient(llmExtractPaymentRoutes, makeEnv(), {
      oidcAuth: MOCK_USER,
      llmModel: mockModelReturning({
        date: "2026-06-01",
        categoryId: 101,
        genreId: 201,
        accountId: 1,
        place: "スーパーA",
        items: [{ name: null, amount: 1980, comment: null }],
        confidence: "high",
        reasoning: "ok",
      }),
      // pageContent が欠如
    }).api.llm["extract-payment"].$post({
      json: { categories: [], accounts: [], recentStores: [] } as unknown as ExtractPaymentBody,
    });
    expect(res.status).toBe(400);
  });

  test("正常系: LLM の抽出結果をそのまま返す", async () => {
    const expected: ExtractedPayment = {
      date: "2026-06-01",
      categoryId: 101,
      genreId: 201,
      accountId: 1,
      place: "スーパーA",
      items: [
        { name: "りんご", amount: 980, comment: null },
        { name: "牛乳", amount: 1000, comment: "1L" },
      ],
      confidence: "high",
      reasoning: "金額と日付が明確に記載されていた",
    };

    const res = await createTestClient(llmExtractPaymentRoutes, makeEnv(), {
      oidcAuth: MOCK_USER,
      llmModel: mockModelReturning(expected),
    }).api.llm["extract-payment"].$post({ json: makeBody() });

    expect(res.status).toBe(200);
    const body = (await res.json()) as ExtractedPayment;
    expect(body).toEqual(expected);
  });

  test("LLM 呼び出しが失敗したとき502を返す", async () => {
    const res = await createTestClient(llmExtractPaymentRoutes, makeEnv(), {
      oidcAuth: MOCK_USER,
      llmModel: mockModelThrowing(),
    }).api.llm["extract-payment"].$post({ json: makeBody() });

    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/extract/i);
  });
});
