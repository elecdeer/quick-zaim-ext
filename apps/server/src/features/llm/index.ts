/**
 * LLM による支払い情報抽出ルート
 *
 * エンドポイント:
 *   POST /api/llm/extract-payment - ページ内容と候補リストから支払い情報を抽出する
 */

import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import type { HonoEnv } from "../../env.ts";
import { requireOidcAuth } from "../../middleware.ts";
import { ExtractPaymentBodySchema } from "./schema.ts";
import { runExtractPayment } from "./service.ts";

export const llmExtractPaymentRoutes = new Hono<HonoEnv>().post(
  "/api/llm/extract-payment",
  requireOidcAuth,
  sValidator("json", ExtractPaymentBodySchema, (result, c) => {
    if (!result.success) return c.json({ error: "Invalid request body" }, 400);
  }),
  async (c) => {
    const logger = c.var.logger;
    const input = c.req.valid("json");

    try {
      const { object, usage, timing } = await runExtractPayment({
        ai: c.env.AI,
        model: c.env.LLM_MODEL,
        input,
      });
      logger
        .with({
          model: c.env.LLM_MODEL,
          usage,
          confidence: object.confidence,
          ...timing,
        })
        .debug(
          "LLM extract-payment completed (confidence={confidence}, ai={aiMs}ms, parse={parseMs}ms, validate={validateMs}ms)",
        );
      return c.json(object);
    } catch (error) {
      logger
        .with({ error: error instanceof Error ? error.message : String(error) })
        .error("LLM extract-payment failed: {error}");
      return c.json({ error: "Failed to extract payment from page" }, 502);
    }
  },
);
