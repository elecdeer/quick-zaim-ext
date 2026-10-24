import type { CategorySelection } from "../components/CategoryCombobox.tsx";
import { findCategorySelectionByGenreId } from "./extraction.ts";

/** LLM が明細ページから抽出した 1 行。読み取れなかった項目は null */
export type ExtractedStatementRow = {
  date: string | null;
  place: string | null;
  amount: number | null;
  genreId: number | null;
};

/** 日付と金額が読み取れており登録に使える明細行 */
export type ReadableStatementRow = ExtractedStatementRow & { date: string; amount: number };

/** 既に Zaim に登録されていると判定した支払い */
export type RegisteredMatch = { id: number; date: string };

/** 一括登録画面で扱う明細行 */
export interface StatementRow {
  id: string;
  date: string;
  place: string;
  /** 最近の店舗に一致したときの店舗 ID。一致しなければ空文字 */
  placeUid: string;
  amount: number;
  category: CategorySelection | null;
  /** 登録対象として選択されているか */
  selected: boolean;
  /** 既に登録済みと判定した支払い。登録済みでなければ null */
  registered: RegisteredMatch | null;
  /** この画面から登録したか */
  submitted: boolean;
}

/**
 * 日付と金額（正の整数）が読み取れた行だけを残す。
 */
export const selectReadableRows = (
  rows: ReadonlyArray<ExtractedStatementRow>,
): ReadableStatementRow[] =>
  rows.flatMap((row) =>
    row.date !== null && row.amount !== null && Number.isInteger(row.amount) && row.amount > 0
      ? [{ ...row, date: row.date, amount: row.amount }]
      : [],
  );

/**
 * 抽出した明細行と登録済み判定の結果から、一括登録画面の行を組み立てる。
 *
 * 登録済みと判定した行は選択を外しておく（誤判定のときはユーザーが選択し直せる）。
 *
 * @param matches `rows` と同じ順序の登録済み判定結果
 */
export const buildStatementRows = (params: {
  rows: ReadonlyArray<ReadableStatementRow>;
  matches: ReadonlyArray<RegisteredMatch | null>;
  recentStores: ReadonlyArray<{ place: string; placeUid: string }>;
  categories: ReadonlyArray<{ id: number; subCategories: ReadonlyArray<{ id: number }> }>;
}): StatementRow[] =>
  params.rows.map((row, index) => {
    const place = row.place ?? "";
    const registered = params.matches[index] ?? null;
    return {
      id: crypto.randomUUID(),
      date: row.date,
      place,
      placeUid: params.recentStores.find((store) => store.place === place)?.placeUid ?? "",
      amount: row.amount,
      category:
        row.genreId !== null
          ? findCategorySelectionByGenreId(params.categories, row.genreId)
          : null,
      selected: registered === null,
      registered,
      submitted: false,
    };
  });
