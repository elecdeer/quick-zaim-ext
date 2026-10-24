import type { CategorySelection } from "../components/CategoryCombobox.tsx";
import { collectFromActiveTab } from "../page-collector/collectFromActiveTab.ts";
import type { createServerClient } from "./serverClient";

type ServerClient = ReturnType<typeof createServerClient>;

/**
 * categories 一覧から `genreId` が属する `categoryId` を逆引きして
 * `CategorySelection` を組み立てる。該当しなければ null。
 *
 * LLM 推論レスポンスには `genreId` しか含まれないため、registration に必要な
 * `categoryId` をここで補完する。
 */
export const findCategorySelectionByGenreId = (
  categories: ReadonlyArray<{ id: number; subCategories: ReadonlyArray<{ id: number }> }>,
  genreId: number,
): CategorySelection | null => {
  for (const category of categories) {
    if (category.subCategories.some((sub) => sub.id === genreId)) {
      return { categoryId: category.id, genreId };
    }
  }
  return null;
};

/**
 * アクティブなタブのページ内容と、LLM 抽出に渡す候補（カテゴリ・有効な口座・最近の店舗）を
 * まとめて取得する。戻り値はそのまま `/api/llm/*` の body に使える。
 */
export const collectExtractionInput = async (client: ServerClient) => {
  const collected = await collectFromActiveTab();

  const [categoriesRes, accountsRes, storesRes] = await Promise.all([
    client.api.zaim.categories.$get({ query: {} }),
    client.api.zaim.accounts.$get({ query: {} }),
    client.api.zaim.stores.$get({ query: {} }),
  ]);
  if (!categoriesRes.ok) throw new Error(`カテゴリの取得に失敗しました（${categoriesRes.status}）`);
  if (!accountsRes.ok) throw new Error(`口座の取得に失敗しました（${accountsRes.status}）`);
  if (!storesRes.ok) throw new Error(`店舗の取得に失敗しました（${storesRes.status}）`);

  const categoriesBody = await categoriesRes.json();
  const accountsBody = await accountsRes.json();
  const storesBody = await storesRes.json();

  const activeAccounts = accountsBody.accounts
    .filter((account) => account.active === 1)
    .map((account) => ({ id: account.id, name: account.name }));

  return {
    pageContent: {
      url: collected.url,
      title: collected.title,
      ariaSnapshot: collected.ariaSnapshot,
      collectedAt: collected.collectedAt,
    },
    categories: categoriesBody.categories,
    accounts: activeAccounts,
    recentStores: storesBody.stores,
  };
};
