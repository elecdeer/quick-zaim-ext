import { createLedgerClient, LedgerFetchError } from "ledger/client";

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
 * Access のセッションを送り、ログイン画面へのリダイレクトを 401 として返す台帳 API クライアントを作る。
 */
export const createServerClient = (serverUrl: string) =>
  createLedgerClient(serverUrl, accessAwareFetch);

/**
 * API の呼び出しが失敗したら、画面に出せるメッセージのエラーに置き換えて投げる。
 * 台帳が返した状態コードがあればメッセージに含める。
 */
export const withErrorMessage = async <T>(action: string, request: Promise<T>): Promise<T> => {
  try {
    return await request;
  } catch (error) {
    const status = error instanceof LedgerFetchError ? `（${error.status}）` : "";
    throw new Error(`${action}に失敗しました${status}`, { cause: error });
  }
};
