import { moneyGetMoney } from "@repo/zaim-api";
import type { createClient } from "@repo/zaim-api/client";
import type { Logger } from "../../loggerMiddleware.ts";
import { toZaimApiErrorContext } from "../../zaimApiError.ts";
import type { MoneyItem } from "./schema.ts";

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

/**
 * Zaim API から全支払いアイテムを取得する。
 */
export const fetchAllMoneyFromZaim = async (
  client: ReturnType<typeof createClient>,
  logger: Logger,
): Promise<MoneyItem[]> => {
  logger.debug("Fetching all money items from Zaim API");

  const result = await moneyGetMoney({
    client,
    query: { mapping: 1, mode: "payment" },
  });

  if (!result.data) {
    logger.error("Failed to fetch money items from Zaim API");
    throw new Error("Failed to fetch money items from Zaim API");
  }

  const moneyList = result.data.money as ZaimMoneyApiItem[];

  const items = moneyList
    .filter((m) => m.place)
    .map((m) => ({
      id: m.id,
      date: m.date,
      amount: m.amount,
      place: m.place,
      placeUid: m.place_uid,
      mode: m.mode,
      categoryId: m.category_id,
      genreId: m.genre_id,
    }));

  logger
    .with({ itemCount: items.length })
    .debug("Zaim API returned {itemCount} money items with places");

  return items;
};

/**
 * 月別の支払いアイテムを Zaim API から取得する。
 */
export const fetchMonthlyMoneyItems = async (
  client: ReturnType<typeof createClient>,
  yearMonth: string,
  logger: Logger,
): Promise<MoneyItem[]> => {
  const start = `${yearMonth}-01`;
  const end = `${yearMonth}-31`;
  const result = await moneyGetMoney({
    client,
    query: { mapping: 1, mode: "payment", start_date: start, end_date: end },
  });

  if (!result.data) {
    const errCtx = toZaimApiErrorContext(result);
    logger
      .with({ yearMonth, ...errCtx })
      .error(
        "Failed to fetch money items from Zaim API (yearMonth={yearMonth}): {upstreamMessage}",
      );
    throw new Error(`Failed to fetch money items from Zaim API: ${errCtx.upstreamMessage}`);
  }

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
};
