/**
 * Zaim 支払い登録・重複チェックルート
 *
 * エンドポイント:
 *   POST /api/zaim/payment          - 支払いアイテムを Zaim に登録する
 *   GET  /api/zaim/payment/duplicate - 支払いアイテムの重複チェックを行う
 *
 * KV キー設計:
 *   zaim:cache:money:{zaim_user_id}:{yyyy-mm}  - 月別支払いキャッシュ（TTL 1時間）
 *   zaim:cache:stores:{zaim_user_id}            - 店舗リストキャッシュ（登録後に削除）
 */

import { moneyGetMoney, paymentOperationsCreate } from "@repo/zaim-api";
import type { createClient } from "@repo/zaim-api/client";
import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import * as v from "valibot";
import type { HonoEnv } from "../env.ts";
import { requireOidcAuth, requireZaimClient } from "../middleware.ts";
import type { MoneyItem, MonthlyMoneyCache } from "./stores.ts";

const CURRENT_MONTH_MONEY_TTL = 3600;

const PaymentBodySchema = v.object({
  category_id: v.pipe(v.number(), v.integer()),
  genre_id: v.pipe(v.number(), v.integer()),
  amount: v.pipe(v.number(), v.integer(), v.minValue(1)),
  date: v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/)),
  from_account_id: v.optional(v.pipe(v.number(), v.integer())),
  comment: v.optional(v.string()),
  name: v.optional(v.string()),
  place: v.optional(v.string()),
  place_uid: v.optional(v.string()),
});

const DuplicateQuerySchema = v.object({
  date: v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/)),
  amount: v.pipe(
    v.string(),
    v.transform(Number),
    v.check((n) => Number.isInteger(n) && n > 0, "amount must be a positive integer"),
  ),
  genre_id: v.pipe(
    v.string(),
    v.transform(Number),
    v.check((n) => Number.isInteger(n), "genre_id must be an integer"),
  ),
});

function yearMonthOf(date: string): string {
  return date.slice(0, 7);
}

function monthStartEnd(yearMonth: string): { start: string; end: string } {
  return {
    start: `${yearMonth}-01`,
    end: `${yearMonth}-31`,
  };
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function fetchMonthlyMoneyItems(
  client: ReturnType<typeof createClient>,
  yearMonth: string,
): Promise<MoneyItem[]> {
  const { start, end } = monthStartEnd(yearMonth);
  const result = await moneyGetMoney({
    client,
    query: { mapping: 1, mode: "payment", start_date: start, end_date: end },
  });

  if (!result.data) {
    throw new Error("Failed to fetch money items from Zaim API");
  }

  type ZaimMoneyApiItem = {
    id: number;
    mode: "income" | "payment" | "transfer";
    date: string;
    category_id: number;
    genre_id: number;
    amount: number;
    place: string;
    place_uid: string;
  };
  const moneyList = result.data.money as ZaimMoneyApiItem[];

  return moneyList.map((m) => ({
    id: m.id,
    date: m.date,
    amount: m.amount,
    place: m.place,
    placeUid: m.place_uid,
    mode: m.mode,
    categoryId: m.category_id,
    genreId: m.genre_id,
  }));
}

// ── POST /api/zaim/payment ────────────────────────────────────────────────────

const createPaymentRoute = new Hono<HonoEnv>().post(
  "/api/zaim/payment",
  requireOidcAuth,
  requireZaimClient,
  sValidator("json", PaymentBodySchema, (result, c) => {
    if (!result.success) return c.json({ error: "Invalid request body" }, 400);
  }),
  async (c) => {
    const logger = c.var.logger;
    const { zaimClient, zaimUserId } = c.var;
    const body = c.req.valid("json");

    logger
      .with({ zaimUserId, amount: body.amount, date: body.date })
      .debug("Registering payment for Zaim user {zaimUserId}");

    const result = await paymentOperationsCreate({
      client: zaimClient,
      query: {
        mapping: 1,
        category_id: body.category_id,
        genre_id: body.genre_id,
        amount: body.amount,
        date: body.date,
        ...(body.from_account_id !== undefined && { from_account_id: body.from_account_id }),
        ...(body.comment !== undefined && { comment: body.comment }),
        ...(body.name !== undefined && { name: body.name }),
        ...(body.place !== undefined && { place: body.place }),
        ...(body.place_uid !== undefined && { place_uid: body.place_uid }),
      },
    });

    if (!result.data) {
      logger.error("Failed to create payment in Zaim API");
      return c.json({ error: "Failed to create payment" }, 502);
    }

    const yearMonth = yearMonthOf(body.date);
    await Promise.all([
      c.env.ZAIM_KV.delete(`zaim:cache:money:${zaimUserId}:${yearMonth}`),
      c.env.ZAIM_KV.delete(`zaim:cache:stores:${zaimUserId}`),
    ]);

    logger
      .with({ zaimUserId, id: result.data.money.id })
      .debug("Payment registered for Zaim user {zaimUserId}, id={id}");

    return c.json(
      {
        id: result.data.money.id,
        modified: result.data.money.modified,
        ...(result.data.money.place_uid !== undefined && {
          placeUid: result.data.money.place_uid,
        }),
      },
      201,
    );
  },
);

// ── GET /api/zaim/payment/duplicate ──────────────────────────────────────────

const getDuplicateRoute = new Hono<HonoEnv>().get(
  "/api/zaim/payment/duplicate",
  requireOidcAuth,
  requireZaimClient,
  sValidator("query", DuplicateQuerySchema, (result, c) => {
    if (!result.success) return c.json({ error: "Invalid query parameters" }, 400);
  }),
  async (c) => {
    const logger = c.var.logger;
    const { zaimClient, zaimUserId } = c.var;
    const { date, amount, genre_id: genreId } = c.req.valid("query");

    const yearMonth = yearMonthOf(date);
    const cacheKey = `zaim:cache:money:${zaimUserId}:${yearMonth}`;

    let items: MoneyItem[];

    const cached = await c.env.ZAIM_KV.get(cacheKey);
    if (cached) {
      logger
        .with({ zaimUserId, yearMonth })
        .debug("Monthly money cache hit for duplicate check ({yearMonth})");
      items = (JSON.parse(cached) as MonthlyMoneyCache).items;
    } else {
      logger
        .with({ zaimUserId, yearMonth })
        .debug("Monthly money cache miss for duplicate check ({yearMonth}), fetching from API");
      items = await fetchMonthlyMoneyItems(zaimClient, yearMonth);
      const cache: MonthlyMoneyCache = { fetchedAt: new Date().toISOString(), items };
      await c.env.ZAIM_KV.put(cacheKey, JSON.stringify(cache), {
        expirationTtl: CURRENT_MONTH_MONEY_TTL,
      });
    }

    const minDate = addDays(date, -1);
    const maxDate = addDays(date, 1);

    const duplicates = items.filter(
      (item) =>
        item.genreId === genreId &&
        item.amount === amount &&
        item.date >= minDate &&
        item.date <= maxDate,
    );

    logger
      .with({ zaimUserId, duplicateCount: duplicates.length })
      .debug("Duplicate check found {duplicateCount} potential duplicates");

    return c.json({ duplicates });
  },
);

export const paymentRoutes = new Hono<HonoEnv>()
  .route("/", createPaymentRoute)
  .route("/", getDuplicateRoute);
