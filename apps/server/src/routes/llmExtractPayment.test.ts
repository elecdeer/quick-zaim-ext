/**
 * llmExtractPayment ルートのテスト
 *
 * POST /api/llm/extract-payment - ページ内容から支払い情報を抽出する
 *
 * Workers AI binding (`env.AI`) をモックで差し替えて実 API を叩かずに振る舞いをテストする。
 * `runExtractPayment` は OpenAI 互換チャットレスポンス形（`choices[0].message.content` に
 * JSON 文字列）を期待するので、モックも同じ形で返す。
 */

import { describe, expect, test, vi } from "vitest";
import type { OidcAuth } from "@hono/oidc-auth";
import type { Ai } from "@cloudflare/workers-types";
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

/**
 * `env.AI.run` がチャット完了レスポンスを返すスタブを作る。
 */
const mockAiReturning = (object: ExtractedPayment): Ai => {
  const run = vi.fn(async () => ({
    choices: [
      {
        message: { content: JSON.stringify(object) },
      },
    ],
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
  }));
  return { run } as unknown as Ai;
};

/**
 * `env.AI.run` が例外を投げるスタブを作る。
 */
const mockAiThrowing = (): Ai => {
  const run = vi.fn(async () => {
    throw new Error("LLM API timeout");
  });
  return { run } as unknown as Ai;
};

const makeEnv = (overrides: Partial<Env> = {}): Env => createTestEnv(overrides);

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

describe("POST /api/llm/extract-payment", () => {
  test("OIDC未認証のとき401を返す", async () => {
    const res = await createTestClient(llmExtractPaymentRoutes, makeEnv(), {
      oidcAuth: null,
    }).api.llm["extract-payment"].$post({ json: makeBody() });
    expect(res.status).toBe(401);
  });

  test("リクエストボディが不正のとき400を返す", async () => {
    const ai = mockAiReturning({
      date: "2026-06-01",
      categoryId: 101,
      genreId: 201,
      accountId: 1,
      place: "スーパーA",
      items: [{ name: null, amount: 1980, comment: null }],
      confidence: "high",
      reasoning: "ok",
    });
    const res = await createTestClient(llmExtractPaymentRoutes, makeEnv({ AI: ai }), {
      oidcAuth: MOCK_USER,
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

    const res = await createTestClient(
      llmExtractPaymentRoutes,
      makeEnv({ AI: mockAiReturning(expected) }),
      {
        oidcAuth: MOCK_USER,
      },
    ).api.llm["extract-payment"].$post({ json: makeBody() });

    expect(res.status).toBe(200);
    const body = (await res.json()) as ExtractedPayment;
    expect(body).toEqual(expected);
  });

  test("LLM 呼び出しが失敗したとき502を返す", async () => {
    const res = await createTestClient(llmExtractPaymentRoutes, makeEnv({ AI: mockAiThrowing() }), {
      oidcAuth: MOCK_USER,
    }).api.llm["extract-payment"].$post({ json: makeBody() });

    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/extract/i);
  });
});
