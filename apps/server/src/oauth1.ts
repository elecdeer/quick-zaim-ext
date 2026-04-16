/**
 * OAuth 1.0a implementation using Web Crypto API (Cloudflare Workers 対応)
 *
 * Zaim API の OAuth フロー:
 *   1. Request Token 取得: POST https://api.zaim.net/v2/auth/request
 *   2. ユーザー認可: https://auth.zaim.net/users/auth?oauth_token=...
 *   3. Access Token 取得: POST https://api.zaim.net/v2/auth/access
 */

const ZAIM_REQUEST_TOKEN_URL = "https://api.zaim.net/v2/auth/request";
const ZAIM_AUTHORIZE_URL = "https://auth.zaim.net/users/auth";
const ZAIM_ACCESS_TOKEN_URL = "https://api.zaim.net/v2/auth/access";

export interface OAuth1Config {
  consumerKey: string;
  consumerSecret: string;
  token?: string;
  tokenSecret?: string;
}

export interface RequestTokenResult {
  oauthToken: string;
  oauthTokenSecret: string;
}

export interface AccessTokenResult {
  oauthToken: string;
  oauthTokenSecret: string;
  userId: string;
}

/** HMAC-SHA1 署名を Base64 エンコードして返す */
async function hmacSha1Base64(key: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

/** RFC 3986 準拠のパーセントエンコード */
function pct(str: string): string {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/**
 * OAuth 1.0a の Authorization ヘッダーを生成する
 *
 * @param method - HTTP メソッド (GET / POST)
 * @param baseUrl - クエリ文字列を含まないリクエスト URL
 * @param config - Consumer Key/Secret とオプションのトークン
 * @param extraOAuthParams - oauth_callback / oauth_verifier など追加 OAuth パラメータ
 * @param bodyOrQueryParams - 署名対象に含める本文またはクエリパラメータ
 */
async function buildAuthorizationHeader(
  method: string,
  baseUrl: string,
  config: OAuth1Config,
  extraOAuthParams: Record<string, string> = {},
  bodyOrQueryParams: Record<string, string> = {},
): Promise<string> {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: config.consumerKey,
    oauth_nonce: crypto.randomUUID().replace(/-/g, ""),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: "1.0",
    ...extraOAuthParams,
  };

  if (config.token) {
    oauthParams.oauth_token = config.token;
  }

  // 署名ベース文字列用にすべてのパラメータをソートして結合
  const allParams = { ...oauthParams, ...bodyOrQueryParams };
  const paramString = Object.entries(allParams)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${pct(k)}=${pct(v)}`)
    .join("&");

  const baseString = `${method.toUpperCase()}&${pct(baseUrl)}&${pct(paramString)}`;
  const signingKey = `${pct(config.consumerSecret)}&${pct(config.tokenSecret ?? "")}`;

  oauthParams.oauth_signature = await hmacSha1Base64(signingKey, baseString);

  // Authorization ヘッダー値を生成
  const headerValue = Object.entries(oauthParams)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${pct(k)}="${pct(v)}"`)
    .join(", ");

  return `OAuth ${headerValue}`;
}

/**
 * Zaim から Request Token を取得する
 * @param config - Consumer Key/Secret
 * @param callbackUrl - OAuth 認可後のコールバック URL
 */
export async function fetchZaimRequestToken(
  config: OAuth1Config,
  callbackUrl: string,
): Promise<RequestTokenResult> {
  const authHeader = await buildAuthorizationHeader("POST", ZAIM_REQUEST_TOKEN_URL, config, {
    oauth_callback: callbackUrl,
  });

  const response = await fetch(ZAIM_REQUEST_TOKEN_URL, {
    method: "POST",
    headers: { Authorization: authHeader },
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
 * @param config - Consumer Key/Secret + Request Token / Secret
 * @param oauthVerifier - Zaim から受け取った oauth_verifier
 */
export async function fetchZaimAccessToken(
  config: OAuth1Config,
  oauthVerifier: string,
): Promise<AccessTokenResult> {
  const authHeader = await buildAuthorizationHeader("POST", ZAIM_ACCESS_TOKEN_URL, config, {
    oauth_verifier: oauthVerifier,
  });

  const response = await fetch(ZAIM_ACCESS_TOKEN_URL, {
    method: "POST",
    headers: { Authorization: authHeader },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Access token failed [${response.status}]: ${body}`);
  }

  const params = new URLSearchParams(await response.text());
  const oauthToken = params.get("oauth_token");
  const oauthTokenSecret = params.get("oauth_token_secret");
  const userId = params.get("user_id");

  if (!oauthToken || !oauthTokenSecret || !userId) {
    throw new Error("Invalid access token response: missing required fields");
  }

  return { oauthToken, oauthTokenSecret, userId };
}

/**
 * 保存済みアクセストークンを使って Zaim API リクエスト用の Authorization ヘッダーを生成する
 *
 * @param config - Consumer Key/Secret + Access Token / Secret
 * @param method - HTTP メソッド
 * @param url - クエリ文字列を含まないリクエスト URL
 * @param queryParams - 署名対象のクエリパラメータ
 */
export async function buildZaimApiAuthHeader(
  config: OAuth1Config,
  method: string,
  url: string,
  queryParams: Record<string, string> = {},
): Promise<string> {
  return buildAuthorizationHeader(method, url, config, {}, queryParams);
}
