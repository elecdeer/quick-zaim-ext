import * as v from "valibot";

export const StoresQuerySchema = v.object({
  no_cache: v.optional(v.string()),
});

export type Store = {
  place: string;
  placeUid: string;
  latestDate: string;
  count: number;
};

export type MoneyItem = {
  id: number;
  date: string;
  amount: number;
  place: string;
  placeUid: string;
  mode: "income" | "payment" | "transfer";
  categoryId: number;
  genreId: number;
};

export type MonthlyMoneyCache = {
  fetchedAt: string;
  items: MoneyItem[];
};

export type StoresResponse = {
  /** Zaim API からデータを取得した日時（ISO 8601） */
  fetchedAt: string;
  stores: Store[];
};
