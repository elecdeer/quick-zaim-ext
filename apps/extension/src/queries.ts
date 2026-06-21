import { createClient } from "server/client";
import { browser } from "wxt/browser";
import { defineQuery } from "./lib/query";
import { fetchAuthStatus, type AuthStatus } from "./entrypoints/sidepanel/authQueries";

// --- Response types ---

type Account = {
  id: number;
  name: string;
  active: number;
  sort: number;
};

export type AccountsResponse = { fetchedAt: string; accounts: Account[] };

type SubCategory = { id: number; name: string };

type Category = {
  id: number;
  name: string;
  mode: "payment" | "income";
  subCategories: SubCategory[];
};

export type CategoriesResponse = { fetchedAt: string; categories: Category[] };

type Store = {
  place: string;
  placeUid: string;
  latestDate: string;
  count: number;
};

export type StoresResponse = { fetchedAt: string; stores: Store[] };

// --- Fetch functions ---

const fetchAccounts = async (serverUrl: string): Promise<AccountsResponse> => {
  const client = createClient(serverUrl);
  const res = await client.api.zaim.accounts.$get(
    { query: {} },
    { init: { credentials: "include" } },
  );
  if (!res.ok) throw new Error("口座の取得に失敗しました");
  return res.json();
};

const fetchCategories = async (serverUrl: string): Promise<CategoriesResponse> => {
  const client = createClient(serverUrl);
  const res = await client.api.zaim.categories.$get(
    { query: {} },
    { init: { credentials: "include" } },
  );
  if (!res.ok) throw new Error("カテゴリの取得に失敗しました");
  return res.json();
};

const fetchStores = async (serverUrl: string): Promise<StoresResponse> => {
  const client = createClient(serverUrl);
  const res = await client.api.zaim.stores.$get(
    { query: {} },
    { init: { credentials: "include" } },
  );
  if (!res.ok) throw new Error("店舗の取得に失敗しました");
  return res.json();
};

// --- Query definitions ---

/** ブラウザストレージからサーバー URL を読み込む */
export const serverUrlQuery = defineQuery<void, string>({
  queryFn: async () => {
    const result = await browser.storage.local.get("serverUrl");
    return (result.serverUrl as string) || "";
  },
});

/** サーバーとの認証状態を取得する */
export const authStatusQuery = defineQuery<string, AuthStatus>({
  queryFn: (serverUrl) => fetchAuthStatus(serverUrl),
});

/** Zaim カテゴリ一覧を取得する */
export const categoriesQuery = defineQuery<string, CategoriesResponse>({
  queryFn: (serverUrl) => fetchCategories(serverUrl),
});

/** Zaim 口座一覧を取得する */
export const accountsQuery = defineQuery<string, AccountsResponse>({
  queryFn: (serverUrl) => fetchAccounts(serverUrl),
});

/** Zaim 店舗一覧を取得する */
export const storesQuery = defineQuery<string, StoresResponse>({
  queryFn: (serverUrl) => fetchStores(serverUrl),
});

/** 全クエリのキャッシュをリセットする（テスト用） */
export const resetAllQueries = (): void => {
  serverUrlQuery.resetAll();
  authStatusQuery.resetAll();
  categoriesQuery.resetAll();
  accountsQuery.resetAll();
  storesQuery.resetAll();
};
