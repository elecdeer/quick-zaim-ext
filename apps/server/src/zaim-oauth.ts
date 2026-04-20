/**
 * Zaim API の OAuth 1.0a 認証ヘルパー
 *
 * Zaim 固有のエンドポイント URL とトークン取得ロジックをまとめる。
 * 汎用 OAuth 1.0a 署名処理は oauth1.ts に委譲する。
 *
 * Zaim OAuth フロー:
 *   1. Request Token 取得: POST https://api.zaim.net/v2/auth/request
 *   2. ユーザー認可: https://auth.zaim.net/users/auth?oauth_token=...
 *   3. Access Token 取得: POST https://api.zaim.net/v2/auth/access
 */

import { buildOAuth1AuthorizationHeader, type OAuth1Config } from "./oauth1.ts";

const ZAIM_REQUEST_TOKEN_URL = "https://api.zaim.net/v2/auth/request";
const ZAIM_AUTHORIZE_URL = "https://auth.zaim.net/users/auth";
const ZAIM_ACCESS_TOKEN_URL = "https://api.zaim.net/v2/auth/access";

export interface RequestTokenResult {
  oauthToken: string;
  oauthTokenSecret: string;
}

export interface AccessTokenResult {
  oauthToken: string;
  oauthTokenSecret: string;
  userId: string;
}

/**
 * Zaim から Request Token を取得する
 * @param config      - Consumer Key / Secret
 * @param callbackUrl - OAuth 認可後のコールバック URL
 */
export async function fetchZaimRequestToken(
  config: OAuth1Config,
  callbackUrl: string,
): Promise<RequestTokenResult> {
  const authHeader = await buildOAuth1AuthorizationHeader("POST", ZAIM_REQUEST_TOKEN_URL, config, {
    oauth_callback: callbackUrl,
  });

  const response = await fetch(ZAIM_REQUEST_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Request token failed [${response.status}]: ${body}`);
  }

  const params = new URLSearchParams(await response.text());
  const oauthToken = params.get("oauth_token");
  const oauthTokenSecret = params.get("oauth_token_secret");

  if (!oauthToken || !oauthTokenSecret) {
    throw new Error("Invalid request token response: missing oauth_token or oauth_token_secret");
  }

  return { oauthToken, oauthTokenSecret };
}

/** Zaim ユーザー認可 URL を構築する */
export function buildZaimAuthorizeUrl(oauthToken: string): string {
  return `${ZAIM_AUTHORIZE_URL}?oauth_token=${encodeURIComponent(oauthToken)}`;
}

/**
 * Request Token と Verifier を使って Access Token を取得する
 * @param config        - Consumer Key / Secret + Request Token / Secret
 * @param oauthVerifier - Zaim から受け取った oauth_verifier
 */
export async function fetchZaimAccessToken(
  config: OAuth1Config,
  oauthVerifier: string,
): Promise<AccessTokenResult> {
  const authHeader = await buildOAuth1AuthorizationHeader("POST", ZAIM_ACCESS_TOKEN_URL, config, {
    oauth_verifier: oauthVerifier,
  });

  const response = await fetch(ZAIM_ACCESS_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Access token failed [${response.status}]: ${body}`);
  }

  const body = await response.text();
  const params = new URLSearchParams(body);
  const oauthToken = params.get("oauth_token");
  const oauthTokenSecret = params.get("oauth_token_secret");
  const userId = params.get("user_id");

  if (!oauthToken || !oauthTokenSecret || !userId) {
    throw new Error(`Invalid access token response: missing required fields. body=${body}`);
  }

  return { oauthToken, oauthTokenSecret, userId };
}

/**
 * 保存済みアクセストークンを使って Zaim API リクエスト用の Authorization ヘッダーを生成する
 * @param config      - Consumer Key / Secret + Access Token / Secret
 * @param method      - HTTP メソッド
 * @param url         - クエリ文字列を含まないリクエスト URL
 * @param queryParams - 署名対象のクエリパラメータ
 */
export async function buildZaimApiAuthHeader(
  config: OAuth1Config,
  method: string,
  url: string,
  queryParams: Record<string, string> = {},
): Promise<string> {
  return buildOAuth1AuthorizationHeader(method, url, config, {}, queryParams);
}
