import type { LedgerOutput } from "ledger/client";
import { createServerClient } from "./lib/serverClient";
import { browser } from "wxt/browser";
import { defineQuery } from "./lib/query";
import { fetchAuthStatus, type AuthStatus } from "./entrypoints/sidepanel/authQueries";

// --- Response types ---

export type AccountsResponse = LedgerOutput<"/api/accounts", "GET">;
export type CategoriesResponse = LedgerOutput<"/api/categories", "GET">;
export type PlacesResponse = LedgerOutput<"/api/places", "GET">;

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

/** 支出のカテゴリと内訳の一覧を取得する */
export const categoriesQuery = defineQuery<string, CategoriesResponse>({
  queryFn: (serverUrl) =>
    createServerClient(serverUrl)("/api/categories", "GET", { query: { mode: "payment" } }),
});

/** 口座の一覧を取得する */
export const accountsQuery = defineQuery<string, AccountsResponse>({
  queryFn: (serverUrl) => createServerClient(serverUrl)("/api/accounts", "GET"),
});

/** 店舗の一覧を、最後に使った日の新しい順で取得する */
export const placesQuery = defineQuery<string, PlacesResponse>({
  queryFn: (serverUrl) => createServerClient(serverUrl)("/api/places", "GET"),
});

/** 全クエリのキャッシュをリセットする（テスト用） */
export const resetAllQueries = (): void => {
  serverUrlQuery.resetAll();
  authStatusQuery.resetAll();
  categoriesQuery.resetAll();
  accountsQuery.resetAll();
  placesQuery.resetAll();
};
