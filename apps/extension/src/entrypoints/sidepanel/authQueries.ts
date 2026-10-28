import { LedgerFetchError, type LedgerOutput } from "ledger/client";
import { createServerClient } from "../../lib/serverClient";

export type ServerUser = LedgerOutput<"/me", "GET">;

export interface AuthStatus {
  isServerAuthenticated: boolean;
  serverUser: ServerUser | null;
}

export const UNAUTHENTICATED: AuthStatus = {
  isServerAuthenticated: false,
  serverUser: null,
};

/**
 * サーバーにログインしているかを確かめる。サーバーがエラーを返したら未ログインとして扱う。
 */
export const fetchAuthStatus = async (url: string): Promise<AuthStatus> => {
  try {
    const user = await createServerClient(url)("/me", "GET");
    return { isServerAuthenticated: true, serverUser: user };
  } catch (error) {
    if (error instanceof LedgerFetchError) return UNAUTHENTICATED;
    throw new Error("サーバーへの接続に失敗しました", { cause: error });
  }
};
