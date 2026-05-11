/**
 * Zaim API 関数定義（スタブ）
 *
 * 本来は @hey-api/openapi-ts が TypeSpec から生成するファイルだが、
 * コード生成を実行できない環境向けに手動で定義している。
 */

import type { Client, RequestResult } from "./client/index.ts";

// ── 型定義 ─────────────────────────────────────────────────────────────────

export type ZaimAccount = {
  id: number;
  name: string;
  modified: string;
  sort: number;
  active: number;
  local_id: number;
  website_id: number;
  parent_account_id: number;
};

export type ZaimCategory = {
  id: number;
  name: string;
  mode: "payment" | "income";
};

export type ZaimGenre = {
  id: number;
  name: string;
  category_id: number;
};

export type ZaimMoneyItem = {
  id: number;
  mode: "income" | "payment" | "transfer";
  user_id: number;
  date: string;
  category_id: number;
  genre_id: number;
  to_account_id: number;
  from_account_id: number;
  amount: number;
  comment: string;
  active: number;
  name: string;
  receipt_id: number;
  place: string;
  place_uid: string;
  created: string;
  currency_code: string;
};

// ── API 関数 ────────────────────────────────────────────────────────────────

export function accountGetAccounts(_options: {
  client: Client;
  query?: { mapping?: number };
}): RequestResult<{ accounts: ZaimAccount[] }> {
  return Promise.resolve({ data: undefined, error: undefined, response: new Response() });
}

export function categoryGetCategories(_options: {
  client: Client;
  query?: { mapping?: number };
}): RequestResult<{ categories: ZaimCategory[] }> {
  return Promise.resolve({ data: undefined, error: undefined, response: new Response() });
}

export function genreGetGenres(_options: {
  client: Client;
  query?: { mapping?: number };
}): RequestResult<{ genres: ZaimGenre[] }> {
  return Promise.resolve({ data: undefined, error: undefined, response: new Response() });
}

export function moneyGetMoney(_options: {
  client: Client;
  query?: {
    mode?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
    page?: number;
    mapping?: number;
  };
}): RequestResult<{ money: ZaimMoneyItem[] }> {
  return Promise.resolve({ data: undefined, error: undefined, response: new Response() });
}

export function authRequestToken(_options: {
  client: Client;
  headers?: Record<string, string>;
}): RequestResult<string> {
  return Promise.resolve({ data: undefined, error: undefined, response: new Response() });
}

export function authAccessToken(_options: {
  client: Client;
  headers?: Record<string, string>;
}): RequestResult<string> {
  return Promise.resolve({ data: undefined, error: undefined, response: new Response() });
}

export function userVerifyUser(_options: {
  client: Client;
}): RequestResult<{ me: { id: number } }> {
  return Promise.resolve({ data: undefined, error: undefined, response: new Response() });
}
