import type { LedgerInput } from "ledger/client";
import type { CategorySelection } from "../components/CategoryCombobox.tsx";
import { collectFromActiveTab } from "../page-collector/collectFromActiveTab.ts";
import type { CategoriesResponse } from "../queries.ts";

/** 台帳の読み取り API に送るページの内容 */
export type PageContent = LedgerInput<"/api/transactions/extract", "POST">["body"]["pageContent"];

/**
 * categories 一覧から `genreId` が属する `categoryId` を逆引きして
 * `CategorySelection` を組み立てる。該当しなければ null。
 *
 * LLM 推論レスポンスには `genreId` しか含まれないため、registration に必要な
 * `categoryId` をここで補完する。
 */
export const findCategorySelectionByGenreId = (
  categories: CategoriesResponse["categories"],
  genreId: number,
): CategorySelection | null => {
  for (const category of categories) {
    if (category.genres.some((genre) => genre.id === genreId)) {
      return { categoryId: category.id, genreId };
    }
  }
  return null;
};

/**
 * アクティブなタブから、台帳の読み取り API に送るページの内容を集める。
 * 口座・カテゴリ・店舗の候補は台帳が自分で読むので送らない。
 */
export const collectPageContent = async (): Promise<PageContent> => {
  const collected = await collectFromActiveTab();
  return {
    url: collected.url,
    title: collected.title,
    ariaSnapshot: collected.ariaSnapshot,
    collectedAt: collected.collectedAt,
  };
};
