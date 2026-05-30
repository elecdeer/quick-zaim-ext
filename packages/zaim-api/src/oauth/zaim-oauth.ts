/**
 * Zaim API の OAuth 1.0a エンドポイント定義
 *
 * エンドポイントの API 契約は TypeSpec (typespec/auth.tsp) で定義。
 *
 * Zaim OAuth フロー:
 *   1. Request Token 取得: POST https://api.zaim.net/v2/auth/request
 *   2. ユーザー認可: https://auth.zaim.net/users/auth?oauth_token=...
 *   3. Access Token 取得: POST https://api.zaim.net/v2/auth/access
 *   4. ユーザー ID 取得: GET https://api.zaim.net/v2/home/user/verify
 */

import { type OAuth1Config, buildOAuth1AuthorizationHeader } from "./oauth1";

export const ZAIM_AUTHORIZE_URL = "https://auth.zaim.net/users/auth";

export interface RequestTokenResult {
  oauthToken: string;
  oauthTokenSecret: string;
}

export interface AccessTokenResult {
  oauthToken: string;
  oauthTokenSecret: string;
}

/** Zaim ユーザー認可 URL を構築する */
export const buildZaimAuthorizeUrl = (oauthToken: string): string =>
  `${ZAIM_AUTHORIZE_URL}?oauth_token=${encodeURIComponent(oauthToken)}`;

/**
 * 保存済みアクセストークンを使って Zaim API リクエスト用の Authorization ヘッダーを生成する
 * @param config      - Consumer Key / Secret + Access Token / Secret
 * @param method      - HTTP メソッド
 * @param url         - クエリ文字列を含まないリクエスト URL
 * @param queryParams - 署名対象のクエリパラメータ
 */
export const buildZaimApiAuthHeader = async (
  config: OAuth1Config,
  method: string,
  url: string,
  queryParams: Record<string, string> = {},
): Promise<string> => buildOAuth1AuthorizationHeader(method, url, config, {}, queryParams);
