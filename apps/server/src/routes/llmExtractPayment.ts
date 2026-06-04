/**
 * LLM による支払い情報抽出ルート
 *
 * エンドポイント:
 *   POST /api/llm/extract-payment - ページ内容と候補リストから支払い情報を抽出する
 *
 * 注意:
 *   - 既存の `/api/*` 共通ミドルウェア（`oidcAuthMiddleware()` + `requireOidcAuth`）で
 *     OIDC 認証は済んでいる前提だが、テスト用にもう一度 `requireOidcAuth` を付ける。
 *   - Zaim API は呼ばないので `requireZaimClient` は不要。
 *   - `c.var.llmModel` が設定されていればそれを使う（テスト時のモック差し込み用）。
 *     未設定なら `c.env` から LLM プロバイダ／モデルを構築する。
 */

import { sValidator } from "@hono/standard-validator";
import type { LanguageModel } from "ai";
import { Hono } from "hono";
import type { HonoEnv } from "../env.ts";
import { ExtractPaymentBodySchema, runExtractPayment } from "../llm/extractPayment.ts";
import { createLanguageModel } from "../llm/model.ts";
import { requireOidcAuth } from "../middleware.ts";

const extractPaymentRoute = new Hono<HonoEnv & { Variables: { llmModel?: LanguageModel } }>().post(
  "/api/llm/extract-payment",
  requireOidcAuth,
  sValidator("json", ExtractPaymentBodySchema, (result, c) => {
    if (!result.success) return c.json({ error: "Invalid request body" }, 400);
  }),
  async (c) => {
    const logger = c.var.logger;
    const input = c.req.valid("json");

    const model =
      c.var.llmModel ?? createLanguageModel({ binding: c.env.AI, model: c.env.LLM_MODEL });

    try {
      const { object, usage } = await runExtractPayment({ model, input });
      logger
        .with({
          model: c.env.LLM_MODEL,
          usage,
          confidence: object.confidence,
        })
        .debug("LLM extract-payment completed (confidence={confidence})");
      return c.json(object);
    } catch (error) {
      logger
        .with({ error: error instanceof Error ? error.message : String(error) })
        .error("LLM extract-payment failed: {error}");
      return c.json({ error: "Failed to extract payment from page" }, 502);
    }
  },
);

export const llmExtractPaymentRoutes = new Hono<HonoEnv>().route("/", extractPaymentRoute);
