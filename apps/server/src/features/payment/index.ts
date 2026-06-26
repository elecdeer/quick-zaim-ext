/**
 * Zaim 支払い登録・重複チェックルート
 *
 * エンドポイント:
 *   POST /api/zaim/payment          - 支払いアイテムを Zaim に登録する
 *   GET  /api/zaim/payment/duplicate - 支払いアイテムの重複チェックを行う
 */

import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import type { HonoEnv } from "../../env.ts";
import { requireOidcAuth, requireZaimClient } from "../../middleware.ts";
import { PaymentBodySchema, DuplicateQuerySchema } from "./schema.ts";
import { registerPayment, checkDuplicates } from "./service.ts";

const createPaymentRoute = new Hono<HonoEnv>().post(
  "/api/zaim/payment",
  requireOidcAuth,
  requireZaimClient,
  sValidator("json", PaymentBodySchema, (result, c) => {
    if (!result.success) return c.json({ error: "Invalid request body" }, 400);
  }),
  async (c) => {
    const body = c.req.valid("json");

    const result = await registerPayment({
      kv: c.env.ZAIM_KV,
      zaimClient: c.var.zaimClient,
      zaimUserId: c.var.zaimUserId,
      body,
      logger: c.var.logger,
    });

    if (!result.success) {
      return c.json(
        {
          error: "Failed to create payment",
          upstreamStatus: result.error.upstreamStatus,
          upstreamMessage: result.error.upstreamMessage,
        },
        502,
      );
    }

    return c.json(result.data, 201);
  },
);

const getDuplicateRoute = new Hono<HonoEnv>().get(
  "/api/zaim/payment/duplicate",
  requireOidcAuth,
  requireZaimClient,
  sValidator("query", DuplicateQuerySchema, (result, c) => {
    if (!result.success) return c.json({ error: "Invalid query parameters" }, 400);
  }),
  async (c) => {
    const { date, amount, genre_id: genreId } = c.req.valid("query");

    const duplicates = await checkDuplicates({
      kv: c.env.ZAIM_KV,
      zaimClient: c.var.zaimClient,
      zaimUserId: c.var.zaimUserId,
      date,
      amount,
      genreId,
      logger: c.var.logger,
    });

    return c.json({ duplicates });
  },
);

export const paymentRoutes = new Hono<HonoEnv>()
  .route("/", createPaymentRoute)
  .route("/", getDuplicateRoute);
