import { createClient } from "server/client";

/**
 * サーバー API 用の fetch。
 *
 * サーバーは Cloudflare Access の後ろにあり、未ログインやセッション切れのリクエストは
 * Access のログイン画面へリダイレクトされる。リダイレクトを追うとログイン画面の HTML が
 * 200 で返ってきて JSON の解析で落ちるため、追わずに 401 として扱う。
 * Access のセッション Cookie（CF_Authorization）を送るため credentials は常に include にする。
 */
export const accessAwareFetch: typeof fetch = async (input, init) => {
  const res = await fetch(input, { ...init, credentials: "include", redirect: "manual" });
  if (res.type === "opaqueredirect") {
    return new Response(null, { status: 401, statusText: "Unauthorized" });
  }
  return res;
};

/**
 * Access のセッションを送り、ログイン画面へのリダイレクトを 401 として返すサーバー API クライアントを作る。
 */
export const createServerClient = (serverUrl: string) =>
  createClient(serverUrl, { fetch: accessAwareFetch });
